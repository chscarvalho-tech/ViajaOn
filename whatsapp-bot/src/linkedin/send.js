// Manda o script completo (content/scripts.json → linkedin_dm) para quem já aceitou o
// convite de conexão. Uma mensagem por contato — se `logMessage` já tiver um registro
// 'linkedin_dm' pra esse contato, pulamos (evita reenvio em caso de reexecução do job).
import { canSendNow, markSent, randomDelayMs, sleep } from '../scheduler/rateLimiter.js';
import { listContacts, updateContact, logMessage, listMessages } from '../store/db.js';
import { renderMessage } from '../content/render.js';
import { scheduleNurture } from '../scheduler/cadence.js';
import { links } from '../config.js';

async function findMessageBox(page) {
  const byRole = page.getByRole('textbox', { name: /Write a message|Escreva uma mensagem/i }).first();
  if (await byRole.count()) return byRole;
  return page.locator('div[contenteditable="true"]').last();
}

export async function sendLinkedinMessages(context, { dryRun = false, limit = Infinity } = {}) {
  const connected = await listContacts({ canal: 'linkedin', status: 'conectado' });
  let sent = 0;

  for (const contact of connected) {
    if (sent >= limit) break;

    const already = await listMessages({ contactId: contact.id });
    if (already.some((m) => m.script === 'linkedin_dm')) continue;

    const gate = await canSendNow('linkedin');
    if (!gate.ok) {
      console.log(`Parando: ${gate.reason}.`);
      break;
    }

    const { texto, variationIndex } = renderMessage('linkedin_dm', {
      NOME: contact.nome || contact.nomeMarca || '',
      NOME_DA_MARCA: contact.nomeMarca || '',
      NICHO: contact.nicho || 'sua área',
      LINK_AGENDA: links.agenda,
    }, { seed: contact.id });

    if (dryRun) {
      console.log(`[dry-run] mensagem para ${contact.nomeMarca}:\n${texto}\n---`);
      continue;
    }

    const page = await context.newPage();
    try {
      await page.goto(contact.linkedinUrl, { waitUntil: 'domcontentloaded' });
      const messageBtn = page.getByRole('button', { name: /^(Message|Mensagem)$/i }).first();
      await messageBtn.click();

      const box = await findMessageBox(page);
      await box.click();
      await box.fill(texto);

      const sendBtn = page.getByRole('button', { name: /^(Send|Enviar)$/i }).last();
      await sendBtn.click();

      await updateContact(contact.id, { status: 'abordado' });
      await logMessage({ contactId: contact.id, script: 'linkedin_dm', canal: 'linkedin', texto, variationIndex });
      await markSent('linkedin');
      if (contact.telefone) await scheduleNurture(contact.id);
      sent += 1;
      console.log(`[ok] mensagem enviada para ${contact.nomeMarca || contact.linkedinUrl}`);
    } catch (err) {
      console.error(`[erro] ${contact.linkedinUrl}: ${err.message}`);
      await logMessage({ contactId: contact.id, script: 'linkedin_dm', canal: 'linkedin', texto, status: 'erro', erro: err.message });
    } finally {
      await page.close();
    }

    await sleep(randomDelayMs('linkedin'));
  }

  return sent;
}
