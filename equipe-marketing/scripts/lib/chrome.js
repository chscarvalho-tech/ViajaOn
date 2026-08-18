// Renderiza um arquivo HTML local para PNG usando Chrome headless — sem Playwright, sem
// Puppeteer, sem custo. Abordagem validada na campanha "Alinhamento de Milhas" (ver addendum
// em knowledge/product_campaign.md): grátis, local, pixel-perfect, sem o texto embaralhado que
// a geração de IA generativa (Canva) produziu em múltiplas tentativas.
//
// Duas lições daquela campanha aplicadas aqui:
// 1. Usar child_process direto (não wrappers que montam array de argumentos de forma que possa
//    ser corrompida) — aqui usamos execFileSync, que passa cada argumento como string separada,
//    sem depender de escaping de shell.
// 2. Um --user-data-dir novo (GUID aleatório) a cada render, pra evitar o Chrome servir HTML
//    em cache de um arquivo que acabou de ser sobrescrito.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CANDIDATE_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const p of CANDIDATE_PATHS) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    'Chrome não encontrado. Defina CHROME_PATH no .env apontando pro executável, ou instale o ' +
      'Google Chrome no caminho padrão.'
  );
}

// htmlPath e outPngPath devem ser caminhos absolutos.
export function renderHtmlToPng(htmlPath, outPngPath, { width = 1080, height = 1080 } = {}) {
  const chrome = findChrome();
  const profileDir = mkdtempSync(path.join(tmpdir(), 'viajaon-chrome-'));
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

  try {
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        `--user-data-dir=${profileDir}`,
        `--window-size=${width},${height}`,
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--default-background-color=00000000',
        '--virtual-time-budget=4000',
        `--screenshot=${outPngPath}`,
        fileUrl,
      ],
      { stdio: 'pipe', timeout: 30000 }
    );
  } finally {
    // Bloco de limpeza separado do de renderização — o hook de segurança deste ambiente
    // bloqueia Remove-Item -Force quando a string "C:\Program" aparece no mesmo bloco de
    // comando PowerShell que a deleção, mesmo sem relação com o caminho apagado. Isso é sobre
    // Node (rmSync), não PowerShell, então não se aplica aqui — mas mantemos a limpeza isolada
    // em try/finally por robustez, não por causa do hook.
    rmSync(profileDir, { recursive: true, force: true });
  }

  if (!existsSync(outPngPath)) {
    throw new Error(`Chrome não gerou ${outPngPath} — rode sem --virtual-time-budget pra depurar.`);
  }
}
