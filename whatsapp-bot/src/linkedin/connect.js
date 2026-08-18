// Envia pedidos de conexão para contatos do ICP 1 (Apollo). Importante: o LinkedIn limita
// a nota de convite a ~300 caracteres, e o script de abordagem completo (content/scripts.json,
// "linkedin_dm") tem bem mais que isso. Por isso o fluxo real é em duas etapas:
//   1) connect.js  — manda o convite de conexão (sem nota, ou com uma nota curta)
//   2) send.js     — depois que a pessoa aceitar, manda o script completo como mensagem
// checkAccepted.js é quem detecta quando um convite foi aceito.
import { canSendNow, markSent, randomDelayMs, sleep } from '../scheduler/rateLimiter.js';
import { listContacts, updateContact, logMessage } from '../store/db.js';

async function findConnectButton(page) {
  const byRole = page.getByRole('button', { name: /^(Connect|Conectar)$/i }).first();
  if (await byRole.count()) return byRole;
  // Em alguns layouts o botão "Conectar" fica dentro de um menu "Mais"/"More".
  const more = page.getByRole('button', { name: /^(More|Mais)$/i }).first();
  if (await more.count()) {
    await more.click();
    const inMenu = page.getByRole('menuitem', { name: /Connect|Conectar/i }).first();
    if (await inMenu.count()) return inMenu;
  }
  return null;
}

export async function sendConnectionRequests(context, { dryRun = false, limit = Infinity } = {}) {
  const pending = await listContacts({ canal: 'linkedin', status: 'novo' });
  let sent = 0;

  for (const contact of pending) {
    if (sent >= limit) break;
    const gate = await canSendNow('linkedin');
    if (!gate.ok) {
      console.log(`Parando: ${gate.reason}.`);
      break;
    }

    const page = await context.newPage();
    try {
      await page.goto(contact.linkedinUrl, { waitUntil: 'domcontentloaded' });
      const connectBtn = await findConnectButton(page);
      if (!connectBtn) {
        console.log(`[pular] ${contact.nomeMarca || contact.linkedinUrl}: não achei o botão de conectar (já conectado? perfil fora do padrão?).`);
        await updateContact(contact.id, { status: 'revisar_manual' });
        await page.close();
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] conectaria com ${contact.nomeMarca || contact.linkedinUrl}`);
        await page.close();
        continue;
      }

      await connectBtn.click();
      // Diálogo "Adicionar uma nota?" — mandamos sem nota pra não truncar o discurso;
      // o discurso completo vai na mensagem, depois que a pessoa aceitar.
      const sendWithoutNote = page.getByRole('button', { name: /Send without a note|Enviar sem nota/i }).first();
      if (await sendWithoutNote.count()) {
        await sendWithoutNote.click();
      } else {
        const sendBtn = page.getByRole('button', { name: /^(Send|Enviar)$/i }).first();
        if (await sendBtn.count()) await sendBtn.click();
      }

      await updateContact(contact.id, { status: 'convite_enviado' });
      await logMessage({ contactId: contact.id, script: 'linkedin_connect_request', canal: 'linkedin', texto: '(convite sem nota)' });
      await markSent('linkedin');
      sent += 1;
      console.log(`[ok] convite enviado para ${contact.nomeMarca || contact.linkedinUrl}`);
    } catch (err) {
      console.error(`[erro] ${contact.linkedinUrl}: ${err.message}`);
      await updateContact(contact.id, { status: 'erro' });
    } finally {
      await page.close();
    }

    await sleep(randomDelayMs('linkedin'));
  }

  return sent;
}
