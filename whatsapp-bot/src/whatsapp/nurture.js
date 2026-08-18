// Dispara os passos vencidos da cadência D+1/D+3/D+10 (ver src/scheduler/cadence.js).
import { canSendNow, markSent, randomDelayMs, sleep } from '../scheduler/rateLimiter.js';
import { listContacts, logMessage, isOptedOut } from '../store/db.js';
import { buildDueNurtureMessages, markNurtureSent } from '../scheduler/cadence.js';
import { sendText } from './sender.js';

export async function sendDueNurture(sock, { dryRun = false } = {}) {
  const all = await listContacts({});
  const byId = new Map(all.map((c) => [c.id, c]));
  const due = await buildDueNurtureMessages(byId);

  let sent = 0;
  for (const { contact, step, scriptKey, texto } of due) {
    if (!contact.telefone) continue;
    if (await isOptedOut(contact.telefone)) {
      await markNurtureSent(contact.id, step);
      continue;
    }

    const gate = await canSendNow('whatsapp');
    if (!gate.ok) {
      console.log(`Parando cadência: ${gate.reason}.`);
      break;
    }

    if (dryRun) {
      console.log(`[dry-run] cadência ${step} para ${contact.nomeMarca}:\n${texto}\n---`);
      await markNurtureSent(contact.id, step);
      continue;
    }

    try {
      await sendText(sock, contact.telefone, texto);
      await logMessage({ contactId: contact.id, script: scriptKey, canal: 'whatsapp', texto });
      await markSent('whatsapp');
      await markNurtureSent(contact.id, step);
      sent += 1;
      console.log(`[ok] cadência ${step} enviada para ${contact.nomeMarca}`);
    } catch (err) {
      console.error(`[erro] cadência ${step} para ${contact.telefone}: ${err.message}`);
    }

    await sleep(randomDelayMs('whatsapp'));
  }
  return sent;
}
