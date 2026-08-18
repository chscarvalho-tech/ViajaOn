// Varre a lista de conversas por chats não lidos, extrai a última mensagem recebida e
// processa pelo MESMO roteador do fluxo Baileys (src/whatsapp/inbound.js — opt-out, "quero
// o link", FAQ/objeções, escalonamento). Não muda a lógica de negócio, só troca de onde a
// mensagem vem: em vez do evento `messages.upsert` do Baileys, é varredura periódica do DOM.
//
// Escopo automatizado (o que ESTE bot decide sozinho): opt-out, "quero o teste" de quem já
// foi abordado, e perguntas que batem com content/objections.json. Fora disso, ele escalona
// (loga no console e não inventa resposta) — é o "quando estiverem no escopo da automação"
// que já era a regra do bot original, mantida aqui sem alteração.
//
// NOTA: seletores de lista/badge/bolha não foram validados contra a UI ao vivo nesta sessão —
// rode com --dry-run e acompanhe as primeiras passadas com o navegador visível antes de
// deixar rodando sem olhar (mesmo aviso de session.js e sock.js).
import { handleInboundMessage } from '../whatsapp/inbound.js';

const UNREAD_BADGE = '#pane-side [aria-label*="unread" i], #pane-side [aria-label*="não lida" i], #pane-side [aria-label*="nao lida" i]';
const INCOMING_BUBBLE = 'div.message-in, div[data-id^="false_"]';
const TEXT_IN_BUBBLE = 'span.selectable-text';

function dataIdToJid(dataId) {
  // formato conhecido: "{fromMe}_{jid}_{messageId}" — ex.: "false_5511999999999@c.us_3EB0..."
  const parts = String(dataId || '').split('_');
  return parts[1] || null;
}

async function extractLastIncoming(page) {
  const bubbles = page.locator(INCOMING_BUBBLE);
  const count = await bubbles.count().catch(() => 0);
  if (count === 0) return null;

  const last = bubbles.nth(count - 1);
  const dataId = await last.getAttribute('data-id').catch(() => null);
  const jid = dataIdToJid(dataId);
  if (!jid) return null;

  const textEl = last.locator(TEXT_IN_BUBBLE).first();
  const text = (await textEl.textContent().catch(() => null)) || (await last.textContent().catch(() => ''));
  if (!text || !text.trim()) return null;

  return { jid, text: text.trim() };
}

// Processa até `limit` chats não lidos numa passada. Retorna quantos foram tratados.
export async function checkInboxAndReply(context, sock, { dryRun = false, limit = 20 } = {}) {
  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const badges = page.locator(UNREAD_BADGE);
  const badgeCount = Math.min(await badges.count().catch(() => 0), limit);
  let handled = 0;

  for (let i = 0; i < badgeCount; i += 1) {
    // Reconsulta a cada volta: abrir um chat re-renderiza a lista e os índices anteriores
    // deixam de ser confiáveis.
    const badge = page.locator(UNREAD_BADGE).first();
    if (!(await badge.count().catch(() => 0))) break;

    try {
      const listItem = badge.locator('xpath=ancestor::div[@role="listitem"]').first();
      await listItem.click();
      await page.waitForTimeout(1500);

      const incoming = await extractLastIncoming(page);
      if (!incoming) {
        console.log('[pular] chat não lido sem mensagem recebida legível — abrir manualmente pra checar.');
        continue;
      }

      console.log(`[recebido] ${incoming.jid}: "${incoming.text.slice(0, 80)}"`);
      if (dryRun) {
        console.log('[dry-run] não vou responder, só reportando.');
        handled += 1;
        continue;
      }

      await handleInboundMessage(sock, incoming.jid, incoming.text);
      handled += 1;
    } catch (err) {
      console.error(`[erro ao processar chat não lido] ${err.message}`);
      // segue pro próximo em vez de travar a passada inteira por causa de um chat problemático
    }
  }

  return handled;
}
