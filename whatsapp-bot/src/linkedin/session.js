// Sessão do LinkedIn via contexto persistente do Chromium (Playwright). O login acontece
// uma vez, manualmente, numa janela visível — não tentamos automatizar usuário/senha nem
// 2FA, o que seria mais frágil e mais fácil de disparar verificação de segurança da própria
// LinkedIn. Os cookies ficam salvos em data/state/linkedin-profile e são reaproveitados
// pelas próximas execuções.
import { chromium } from 'playwright';
import { paths } from '../config.js';

const LINKEDIN_FEED = 'https://www.linkedin.com/feed/';

export async function openLinkedinContext({ headless = false } = {}) {
  const context = await chromium.launchPersistentContext(paths.linkedinProfileDir, {
    headless,
    viewport: { width: 1280, height: 900 },
  });
  return context;
}

export async function isLoggedIn(context) {
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(LINKEDIN_FEED, { waitUntil: 'domcontentloaded' });
  const url = page.url();
  return url.includes('/feed');
}

// Abre o navegador e espera você logar manualmente. Detecta o login sozinho, checando
// periodicamente a URL da página (em vez de esperar você apertar ENTER no terminal) — assim
// funciona tanto rodando direto no seu terminal quanto disparado por uma ferramenta que não
// tem um stdin interativo pra ler. Rode `npm run linkedin:login` uma vez antes de connect/send.
export async function loginFlow({ timeoutMs = 10 * 60 * 1000, pollMs = 3000 } = {}) {
  const context = await openLinkedinContext({ headless: false });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  console.log('Faça login manualmente na janela do Chromium que abriu (usuário, senha, 2FA se pedir).');
  console.log('Não precisa fazer mais nada aqui — assim que a sua timeline carregar, eu detecto sozinho.');

  const deadline = Date.now() + timeoutMs;
  let ok = false;
  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes('/feed')) {
      ok = true;
      break;
    }
    await page.waitForTimeout(pollMs).catch(() => {});
  }

  console.log(ok ? 'Login confirmado. Sessão salva.' : `Não detectei o login em ${Math.round(timeoutMs / 60000)} minutos — feche e rode "npm run linkedin:login" de novo quando puder terminar o login.`);
  await context.close();
  return ok;
}
