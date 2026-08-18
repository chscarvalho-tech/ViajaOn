import { normalizePhone } from '../store/db.js';

export function phoneToJid(phone) {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

export async function sendText(sock, phone, text) {
  const jid = phoneToJid(phone);
  await sock.sendMessage(jid, { text });
}
