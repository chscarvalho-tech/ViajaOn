// Adapter que imita a interface mínima do "sock" do Baileys (só `sendMessage(jid, { text })`)
// por cima do WhatsApp Web via Playwright — assim src/whatsapp/sender.js, outreach.js e
// nurture.js continuam funcionando sem nenhuma mudança, tanto faz se por baixo é Baileys
// (src/whatsapp/session.js) ou WhatsApp Web oficial (este arquivo). Só troca quem cria o "sock".
//
// Usa o link de composição documentado do próprio WhatsApp (web.whatsapp.com/send?phone=...&text=...),
// que abre a conversa já com o texto preenchido — mais robusto que digitar caractere a caractere
// na caixa de busca. NOTA: os seletores abaixo não foram validados contra a UI ao vivo nesta
// sessão (ver aviso em session.js) — confira com --dry-run antes de confiar de olhos fechados.
const COMPOSE_BOX = 'footer div[contenteditable="true"][data-tab], div[contenteditable="true"][data-tab="10"]';
const INVALID_PHONE_TEXT = /invalid|inválido|não é possível verificar/i;

function jidToPhone(jid) {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

export function makeWhatsappWebSock(context) {
  return {
    async sendMessage(jid, { text }) {
      const phone = jidToPhone(jid);
      const page = await context.newPage();
      try {
        const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // WhatsApp mostra um modal de erro se o número não tem conta/está mal formatado.
        const errorModal = page.getByText(INVALID_PHONE_TEXT).first();
        if (await errorModal.count().catch(() => 0)) {
          throw new Error(`número inválido ou sem WhatsApp: ${phone}`);
        }

        const compose = page.locator(COMPOSE_BOX).last();
        await compose.waitFor({ state: 'visible', timeout: 30000 });
        await compose.click();
        await page.keyboard.press('Enter');
        // dá tempo do balão da mensagem aparecer antes de fechar a aba — evita fechar no meio
        // do envio e mandar mensagem incompleta ou duplicada na próxima tentativa.
        await page.waitForTimeout(2000);
      } finally {
        await page.close();
      }
    },
  };
}
