// Sessão do WhatsApp via WhatsApp Web oficial (Playwright), não via Baileys. Isto troca "falar
// direto com o protocolo não-documentado" por "operar a mesma interface que um humano usaria" —
// mais lento, mas é a superfície oficial, o que tende a ser mais estável contra bloqueio de
// conta do que uma lib não-oficial batendo direto no protocolo (ver histórico de tentativas
// com src/whatsapp/session.js, que ficou levando "não foi possível conectar" repetidamente).
// Login acontece uma vez, manualmente, escaneando o QR da própria página oficial — os cookies
// ficam salvos em data/state/whatsapp-web-profile e são reaproveitados pelas próximas execuções,
// do mesmo jeito que já funciona para o LinkedIn (src/linkedin/session.js).
import { chromium } from 'playwright';
import { paths } from '../config.js';

const WA_WEB = 'https://web.whatsapp.com/';

// Presente só depois de logado: o painel da lista de conversas.
const LOGGED_IN_SELECTOR = '#pane-side, div[aria-label="Lista de conversas"], div[aria-label="Chat list"]';

export async function openWhatsappWebContext({ headless = false } = {}) {
  const context = await chromium.launchPersistentContext(paths.whatsappWebProfileDir, {
    channel: 'chrome', // usa o Google Chrome instalado de verdade, não o Chromium do Playwright
    headless,
    viewport: { width: 1280, height: 900 },
  });
  return context;
}

export async function isLoggedIn(context, { navigate = true } = {}) {
  const page = context.pages()[0] || (await context.newPage());
  if (navigate) {
    await page.goto(WA_WEB, { waitUntil: 'domcontentloaded' });
  }
  try {
    await page.locator(LOGGED_IN_SELECTOR).first().waitFor({ state: 'visible', timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

// Abre o navegador e espera você escanear o QR manualmente. Detecta o login sozinho (mesma
// lógica do LinkedIn: espera aparecer a lista de conversas, sem precisar de ENTER no terminal).
// NOTA: os seletores acima (LOGGED_IN_SELECTOR) e os de src/whatsapp-web/*.js não foram
// validados contra a UI ao vivo do WhatsApp Web nesta sessão — rode com --dry-run e supervisione
// a primeira leva com o navegador visível (headless: false, já é o padrão) antes de deixar rodando
// sem olhar, do mesmo jeito recomendado para o LinkedIn.
export async function loginFlow({ timeoutMs = 5 * 60 * 1000, pollMs = 3000 } = {}) {
  const context = await openWhatsappWebContext({ headless: false });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(WA_WEB, { waitUntil: 'domcontentloaded' });

  console.log('Escaneie o QR code da janela do WhatsApp Web (oficial) que abriu, com o WhatsApp do número que você quer conectar.');
  console.log('Não precisa fazer mais nada aqui — assim que a lista de conversas carregar, eu detecto sozinho.');

  const deadline = Date.now() + timeoutMs;
  let ok = false;
  while (Date.now() < deadline) {
    if (await isLoggedIn(context, { navigate: false })) {
      ok = true;
      break;
    }
    await page.waitForTimeout(pollMs).catch(() => {});
  }

  console.log(ok ? 'Login confirmado. Sessão salva.' : `Não detectei o login em ${Math.round(timeoutMs / 60000)} minutos — feche e rode "npm run whatsapp-web:login" de novo quando puder terminar o login.`);
  await context.close();
  return ok;
}
