// Verifica quais convites (status 'convite_enviado') já foram aceitos, revisitando o
// perfil e checando se o botão vira "Message"/"Mensagem" (1º grau). Não manda nada,
// só atualiza status — rode antes de `send`. Mais leve que abrir a página de convites
// enviados, e funciona igual mesmo se o LinkedIn mudar o layout dessa página.
import { listContacts, updateContact } from '../store/db.js';
import { sleep } from '../scheduler/rateLimiter.js';

export async function checkAcceptedInvites(context) {
  const pending = await listContacts({ canal: 'linkedin', status: 'convite_enviado' });
  let accepted = 0;

  for (const contact of pending) {
    const page = await context.newPage();
    try {
      await page.goto(contact.linkedinUrl, { waitUntil: 'domcontentloaded' });
      const messageBtn = page.getByRole('button', { name: /^(Message|Mensagem)$/i }).first();
      if (await messageBtn.count()) {
        await updateContact(contact.id, { status: 'conectado' });
        accepted += 1;
        console.log(`[aceito] ${contact.nomeMarca || contact.linkedinUrl}`);
      }
    } catch (err) {
      console.error(`[erro ao checar] ${contact.linkedinUrl}: ${err.message}`);
    } finally {
      await page.close();
    }
    await sleep(1000 + Math.random() * 2000);
  }

  return accepted;
}
