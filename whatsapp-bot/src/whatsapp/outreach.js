// Primeira abordagem via WhatsApp (script "My Maps") para contatos com telefone conhecido.
import { canSendNow, markSent, randomDelayMs, sleep } from '../scheduler/rateLimiter.js';
import { listContacts, updateContact, logMessage } from '../store/db.js';
import { renderMessage } from '../content/render.js';
import { sendText } from './sender.js';
import { scheduleNurture } from '../scheduler/cadence.js';

export async function sendWhatsappOutreach(sock, { dryRun = false, limit = Infinity } = {}) {
  const pending = (await listContacts({ canal: 'whatsapp', status: 'novo' })).filter((c) => c.telefone);
  let sent = 0;

  for (const contact of pending) {
    if (sent >= limit) break;
    const gate = await canSendNow('whatsapp');
    if (!gate.ok) {
      console.log(`Parando: ${gate.reason}.`);
      break;
    }

    const { texto, variationIndex } = renderMessage('whatsapp_mymaps', {
      NOME_DA_MARCA: contact.nomeMarca || '',
      NICHO: contact.nicho || 'sua área',
    }, { seed: contact.id });

    if (dryRun) {
      console.log(`[dry-run] WhatsApp para ${contact.nomeMarca} (${contact.telefone}):\n${texto}\n---`);
      sent += 1;
      continue;
    }

    try {
      await sendText(sock, contact.telefone, texto);
      await updateContact(contact.id, { status: 'abordado' });
      await logMessage({ contactId: contact.id, script: 'whatsapp_mymaps', canal: 'whatsapp', texto, variationIndex });
      await markSent('whatsapp');
      await scheduleNurture(contact.id);
      sent += 1;
      console.log(`[ok] WhatsApp enviado para ${contact.nomeMarca} (${contact.telefone})`);
    } catch (err) {
      console.error(`[erro] ${contact.telefone}: ${err.message}`);
      await logMessage({ contactId: contact.id, script: 'whatsapp_mymaps', canal: 'whatsapp', texto, status: 'erro', erro: err.message });
    }

    await sleep(randomDelayMs('whatsapp'));
  }

  return sent;
}
