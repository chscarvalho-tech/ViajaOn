// Wrapper fino sobre o ffmpeg local (instalado via `winget install Gyan.FFmpeg` — ver README).
// Sem custo, sem serviço externo. Usa execFileSync com argumentos em array (não string de
// shell), pela mesma razão documentada em lib/chrome.js.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  return 'ffmpeg'; // assume no PATH — é o caso comum após `winget install Gyan.FFmpeg`
}

function run(args) {
  return execFileSync(findFfmpeg(), args, { stdio: 'pipe', timeout: 60000 });
}

// Converte um frame estático (PNG) num clipe de `durationSec` com fade in/out — a "transição
// suave, nunca hard cut" pedida em knowledge/product_campaign.md, na versão que dá pra rodar
// localmente sem Remotion.
export function stillToClip(pngPath, outMp4Path, { durationSec, width, height, fadeSec = 0.4 }) {
  const fadeOutStart = Math.max(0, durationSec - fadeSec);
  run([
    '-y',
    '-loop', '1',
    '-i', pngPath,
    '-t', String(durationSec),
    '-vf', `scale=${width}:${height},fade=t=in:st=0:d=${fadeSec},fade=t=out:st=${fadeOutStart}:d=${fadeSec},format=yuv420p`,
    '-r', '30',
    '-pix_fmt', 'yuv420p',
    '-an',
    outMp4Path,
  ]);
}

// Concatena clipes já codificados com os mesmos parâmetros (stream copy, sem recodificar).
export function concatClips(listFilePath, outMp4Path) {
  run(['-y', '-f', 'concat', '-safe', '0', '-i', listFilePath, '-c', 'copy', outMp4Path]);
}
