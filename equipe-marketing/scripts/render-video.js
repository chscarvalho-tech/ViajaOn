#!/usr/bin/env node
// CLI da skill Video Ad Specialist (ver skills/video-ad-specialist/SKILL.md).
// Uso: node scripts/render-video.js [--scenes=caminho/scenes.json] [--task=nome_da_task]
//
// Implementação local que REALMENTE renderiza um .mp4 (Chrome headless por frame + ffmpeg
// fade in/out + concat) — não é o Remotion descrito como arquitetura-alvo em
// knowledge/product_campaign.md, é a via comprovada no addendum daquele arquivo. Sem
// animação word-by-word real; cada scene é um frame estático com fade. Migrar pra Remotion
// quando fizer sentido investir no setup de React — ver notas no SKILL.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { buildSceneHtml } from './lib/sceneHtml.js';
import { renderHtmlToPng } from './lib/chrome.js';
import { stillToClip, concatClips } from './lib/ffmpeg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};

const scenesPath = getArg('scenes');
const taskName = getArg('task') || 'demo_milha_parada';
const today = DateTime.now().toISODate();

// Scene set de demonstração: Conceito 1 ("Milha Parada Não É Economia") de
// knowledge/product_campaign.md, 20s, formato 1080×1350 (feed 4:5).
const defaultScenes = {
  width: 1080,
  height: 1350,
  logoPath: path.join(ROOT, 'assets', 'viajaon_logo_transparent.png'),
  scenes: [
    { type: 'hook', text: 'Suas milhas estão vencendo.', durationSec: 3 },
    { type: 'problem', text: 'Todo mês, pontos que já são seus somem sem virar viagem.', durationSec: 4 },
    { type: 'turn', text: 'A ViajaON mapeia o que você já tem e transforma em passagem.', durationSec: 4 },
    { type: 'proof', text: 'Até 70% mais barato que o preço de balcão, em classe executiva.', durationSec: 4 },
    { type: 'cta', text: 'Você já pagou por essa viagem. Falta só ir.', durationSec: 5 },
  ],
};

const spec = scenesPath ? JSON.parse(readFileSync(scenesPath, 'utf8')) : defaultScenes;
const { width, height, logoPath, scenes } = spec;

const outDir = path.join(ROOT, 'outputs', `${taskName}_${today}`, 'video');
const framesDir = path.join(outDir, 'frames');
mkdirSync(framesDir, { recursive: true });

writeFileSync(path.join(outDir, 'scenes.json'), JSON.stringify(spec, null, 2));

const clipPaths = [];
scenes.forEach((scene, i) => {
  const base = path.join(framesDir, `scene${i}`);
  const { html, css } = buildSceneHtml(scene, { width, height, logoPath });
  writeFileSync(`${base}.html`, html.replace('scene.css', `scene${i}.css`));
  writeFileSync(path.join(framesDir, `scene${i}.css`), css);

  const pngPath = `${base}.png`;
  renderHtmlToPng(`${base}.html`, pngPath, { width, height });

  const clipPath = `${base}.mp4`;
  stillToClip(pngPath, clipPath, { durationSec: scene.durationSec || 3, width, height });
  clipPaths.push(clipPath);
  console.log(`  scene ${i} (${scene.type}) renderizada — ${scene.durationSec || 3}s`);
});

const listFile = path.join(outDir, 'concat-list.txt');
writeFileSync(listFile, clipPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));

const finalPath = path.join(outDir, 'ad.mp4');
concatClips(listFile, finalPath);

console.log(`\nOK — vídeo renderizado em: ${finalPath}`);
