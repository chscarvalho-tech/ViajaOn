import { connectWhatsapp, waitForOpen } from './session.js';
import { sendWhatsappOutreach } from './outreach.js';
import { sendDueNurture } from './nurture.js';
import { handleInboundMessage } from './inbound.js';

export async function whatsappLogin({ phoneNumber } = {}) {
  const sock = await connectWhatsapp({ phoneNumber });
  await waitForOpen(sock);
  console.log('Pronto. A sessão fica salva em data/state/whatsapp-auth — não precisa escanear de novo.');
  process.exit(0);
}

export async function whatsappSend({ dryRun = false } = {}) {
  const sock = await connectWhatsapp();
  await waitForOpen(sock);
  const sent = await sendWhatsappOutreach(sock, { dryRun });
  console.log(`\n${sent} mensagem(ns) de abordagem enviada(s).`);
  process.exit(0);
}

export async function whatsappCadence({ dryRun = false } = {}) {
  const sock = await connectWhatsapp();
  await waitForOpen(sock);
  const sent = await sendDueNurture(sock, { dryRun });
  console.log(`\n${sent} mensagem(ns) de cadência enviada(s).`);
  process.exit(0);
}

// Modo "sempre ligado": só escuta e responde (bot de suporte + link do IPD sob interesse
// + opt-out). Não dispara nada por conta própria — combine com whatsapp:send/whatsapp:cadence
// rodando à parte (ou agendados) para a parte de prospecção.
export async function whatsappBot() {
  const sock = await connectWhatsapp({ onMessage: handleInboundMessage });
  await waitForOpen(sock);
  console.log('Bot de suporte no ar. Escutando mensagens recebidas (Ctrl+C para parar).');
}
