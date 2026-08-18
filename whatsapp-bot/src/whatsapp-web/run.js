import { openWhatsappWebContext, loginFlow, isLoggedIn } from './session.js';
import { makeWhatsappWebSock } from './sock.js';
import { checkInboxAndReply } from './inboundScan.js';
import { sendWhatsappOutreach } from '../whatsapp/outreach.js';
import { sendDueNurture } from '../whatsapp/nurture.js';

export async function whatsappWebLogin() {
  await loginFlow();
}

// Uma passada completa: checa/responde o que chegou, manda abordagem nova (ICP2/My Maps) e
// dispara cadência D+1/D+3/D+10 vencida — nessa ordem, pra responder quem já mandou mensagem
// antes de sair abordando gente nova. Pensado pra ser chamado periodicamente (Agendador de
// Tarefas do Windows chamando `npm run whatsapp-web:run` a cada N minutos dentro do horário
// comercial) — cada passada abre e fecha o navegador, não fica um processo vivo o dia todo.
export async function whatsappWebRun({ dryRun = false } = {}) {
  const context = await openWhatsappWebContext({ headless: false });
  try {
    if (!(await isLoggedIn(context))) {
      console.log('Sessão do WhatsApp Web não está logada. Rode "npm run whatsapp-web:login" primeiro.');
      return { inbound: 0, outreach: 0, cadence: 0 };
    }

    const sock = makeWhatsappWebSock(context);

    console.log('Checando conversas não lidas...');
    const inbound = await checkInboxAndReply(context, sock, { dryRun });
    console.log(`${inbound} conversa(s) não lida(s) tratada(s).`);

    console.log('Enviando abordagem inicial (quem ainda não foi abordado)...');
    const outreach = await sendWhatsappOutreach(sock, { dryRun });
    console.log(`${outreach} abordagem(ns) enviada(s).`);

    console.log('Enviando cadência D+1/D+3/D+10 vencida...');
    const cadence = await sendDueNurture(sock, { dryRun });
    console.log(`${cadence} mensagem(ns) de cadência enviada(s).`);

    console.log(`\nResumo: ${inbound} respondida(s), ${outreach} abordagem(ns), ${cadence} cadência(s).`);
    return { inbound, outreach, cadence };
  } finally {
    await context.close();
  }
}
