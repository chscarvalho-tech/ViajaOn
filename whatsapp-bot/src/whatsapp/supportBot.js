// Bot de respostas do suporte. Por padrão só responde com o que está em
// content/objections.json — nunca inventa resposta fora dali. Se quiser plugar um LLM
// para reformular a resposta encontrada com mais naturalidade (sem gerar conteúdo novo,
// só reescrever o texto já aprovado), o ponto de extensão é `rewriteWithModel` abaixo;
// deixei desligado até vocês decidirem se querem isso e com qual chave de API.
import { findFaq, escalationMessage } from '../content/render.js';
import { getBotConversation, saveBotConversation } from '../store/db.js';

async function rewriteWithModel(_answer, _question, _history) {
  // Extensão opcional — hoje retorna null (não reescreve, usa a resposta literal do FAQ).
  return null;
}

export async function answerSupportQuestion(jid, text) {
  const conv = await getBotConversation(jid);
  conv.history.push({ role: 'user', text, quando: new Date().toISOString() });

  const match = findFaq(text);
  let resposta;
  let matched = Boolean(match);

  if (match) {
    resposta = (await rewriteWithModel(match.resposta, text, conv.history)) || match.resposta;
    conv.lastFaqId = match.id;
    conv.escalated = false;
  } else {
    resposta = escalationMessage();
    conv.escalated = true;
  }

  conv.history.push({ role: 'bot', text: resposta, quando: new Date().toISOString(), faqId: match?.id || null });
  await saveBotConversation(jid, conv);

  return { resposta, matched, escalated: conv.escalated };
}
