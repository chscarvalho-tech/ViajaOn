import { openLinkedinContext, loginFlow, isLoggedIn } from './session.js';
import { sendConnectionRequests } from './connect.js';
import { checkAcceptedInvites } from './checkAccepted.js';
import { sendLinkedinMessages } from './send.js';

export async function linkedinLogin() {
  await loginFlow();
}

export async function linkedinSend({ dryRun = false } = {}) {
  const context = await openLinkedinContext({ headless: false });
  try {
    if (!(await isLoggedIn(context))) {
      console.log('Sessão do LinkedIn não está logada. Rode "npm run linkedin:login" primeiro.');
      return;
    }
    console.log('Verificando convites aceitos...');
    const accepted = await checkAcceptedInvites(context);
    console.log(`${accepted} convite(s) recém-aceito(s).`);

    console.log('Enviando mensagens para quem já está conectado...');
    const sentMsgs = await sendLinkedinMessages(context, { dryRun });

    console.log('Enviando novos convites de conexão (ICP 1)...');
    const sentInvites = await sendConnectionRequests(context, { dryRun });

    console.log(`\nResumo: ${sentInvites} convite(s), ${sentMsgs} mensagem(ns).`);
  } finally {
    await context.close();
  }
}
