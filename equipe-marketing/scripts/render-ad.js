#!/usr/bin/env node
// CLI da skill Ad Creative Designer (ver skills/ad-creative-designer/SKILL.md).
// Uso: node scripts/render-ad.js [--layout=caminho/layout.json] [--task=nome_da_task]
//
// Gera layout.json (se não fornecido, usa um exemplo real do Método ROTA, ancorado em
// knowledge/product_campaign.md → Conceito 1), ad.html, styles.css e instagram_ad.png em
// outputs/<task>_<data>/ads/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { buildAdHtml } from './lib/adHtml.js';
import { renderHtmlToPng } from './lib/chrome.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};

const layoutPath = getArg('layout');
const taskName = getArg('task') || 'demo_milha_parada';
const today = DateTime.now().toISODate();

// Layout de demonstração: texto real do brief de campanha (product_campaign.md, Conceito 1 —
// "Milha Parada Não É Economia"), não texto genérico de placeholder.
const defaultLayout = {
  format: 'instagram_square',
  width: 1080,
  height: 1080,
  template: 'centered_minimal',
  background: '#189898',
  headline: 'Você já pagou por essa viagem.',
  subtext: 'Falta só ir.',
  cta: 'Fale com a ViajaON',
  accent: '#FF943E',
  logoPath: path.join(ROOT, 'assets', 'viajaon_logo_transparent.png'),
};

const layout = layoutPath
  ? JSON.parse(readFileSync(layoutPath, 'utf8'))
  : defaultLayout;

const outDir = path.join(ROOT, 'outputs', `${taskName}_${today}`, 'ads');
mkdirSync(outDir, { recursive: true });

writeFileSync(path.join(outDir, 'layout.json'), JSON.stringify(layout, null, 2));

const { html, css } = buildAdHtml(layout);
writeFileSync(path.join(outDir, 'ad.html'), html);
writeFileSync(path.join(outDir, 'styles.css'), css);

const pngPath = path.join(outDir, 'instagram_ad.png');
renderHtmlToPng(path.join(outDir, 'ad.html'), pngPath, { width: layout.width, height: layout.height });

console.log(`OK — ad renderizado em: ${outDir}`);
console.log(`  layout.json, ad.html, styles.css, instagram_ad.png`);
