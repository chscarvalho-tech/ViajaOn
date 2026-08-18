// Roteia toda mensagem recebida no número: primeiro opt-out, depois "quero marcar a
// call/agenda" (fecha o loop prometido nos scripts de abordagem: "responda que eu mando
// o link"), e só then cai no bot de suporte por FAQ.
import { findContactByPhone, addOptOut, updateContact, logMessage, listMessages } from '../store/db.js';
import { optOutKeywords } from '../content/render.js';
import { answerSupportQuestion } from './supportBot.js';
import { sendText } from './sender.js';
import { links } from '../config.js';

const INTEREST_KEYWORDS = ['sim', 'quero', 'pode', 'manda', 'envia', 'interessa', 'link', 'claro', 'bora'];

function jidToPhone(jid) {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

function matchesAny(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

export async function handleInboundMessage(sock, jid, text) {
  const phone = jidToPhone(jid);

  if (matchesAny(text, optOutKeywords())) {
    const contact = await findContactByPhone(phone);
    await addOptOut({ contactId: contact?.id, telefone: phone, motivo: text });
    await sendText(sock, phone, 'Combinado, não te mando mais mensagens por aqui. Se mudar de ideia, é só chamar.');
    console.log(`[opt-out] ${phone}`);
    return;
  }

  const contact = await findContactByPhone(phone);

  if (contact && contact.status === 'abordado' && matchesAny(text, INTEREST_KEYWORDS)) {
    const already = await listMessages({ contactId: contact.id });
    if (!already.some((m) => m.script === 'agenda_link')) {
      const texto = `Combinado! Aqui está o link pra marcar os 30 minutos: ${links.agenda}\n\nNa call, mapeamos seus cartões e programas de fidelidade e já saímos com uma direção de resgate.`;
      await sendText(sock, phone, texto);
      await logMessage({ contactId: contact.id, script: 'agenda_link', canal: 'whatsapp', texto });
      await updateContact(contact.id, { status: 'interessado' });
      console.log(`[link enviado] ${contact.nomeMarca || phone}`);
      return;
    }
  }

  const { resposta, escalated } = await answerSupportQuestion(jid, text);
  await sendText(sock, phone, resposta);
  await logMessage({ contactId: contact?.id || null, script: escalated ? 'bot_escalonamento' : 'bot_faq', canal: 'whatsapp', texto: resposta });
  if (escalated) {
    console.log(`[ATENÇÃO] pergunta fora do FAQ de ${phone}: "${text}" — respondida com escalonamento, revisar manualmente.`);
  }
}
