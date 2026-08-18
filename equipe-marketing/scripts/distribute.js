#!/usr/bin/env node
// CLI da skill Distribution Agent (ver skills/distribution-agent/SKILL.md).
// Uso: node scripts/distribute.js --task=nome_da_task [--date=YYYY-MM-DD]
//
// Faz upload da mídia da task pro Supabase SE SUPABASE_URL/SUPABASE_SERVICE_KEY estiverem no
// .env; sem isso, cai em fallback de caminho de arquivo local (avisado no console e no MD) —
// não trava o pipeline por falta de credencial paga. Nunca publica: só monta o Publish MD.
// Publicação real (Instagram/YouTube) é decisão manual do usuário, fora deste script.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};

const taskName = getArg('task');
if (!taskName) {
  console.error('Uso: node scripts/distribute.js --task=nome_da_task [--date=YYYY-MM-DD]');
  process.exit(1);
}
const date = getArg('date') || DateTime.now().toISODate();
const taskDir = path.join(ROOT, 'outputs', `${taskName}_${date}`);

if (!existsSync(taskDir)) {
  console.error(`Pasta não encontrada: ${taskDir} — rode render-ad.js/render-video.js primeiro com --task=${taskName}.`);
  process.exit(1);
}

function collectMedia() {
  const files = [];
  for (const sub of ['ads', 'video']) {
    const dir = path.join(taskDir, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (/\.(png|jpg|jpeg|mp4)$/i.test(f)) files.push(path.join(dir, f));
    }
  }
  return files;
}

async function uploadToSupabase(files) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.log('[distribution] SUPABASE_URL/SUPABASE_SERVICE_KEY não configurados — usando caminho local como URL (fallback).');
    return files.map((f) => ({ file: path.basename(f), url: `file:///${f.replace(/\\/g, '/')}` }));
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);
  const bucket = process.env.SUPABASE_BUCKET || 'campaign-uploads';
  const results = [];

  for (const f of files) {
    const base = path.basename(f);
    const objectPath = `${taskName}_${date}/${base}`;
    const data = readFileSync(f);
    const { error } = await supabase.storage.from(bucket).upload(objectPath, data, { upsert: true });
    if (error) {
      console.error(`[erro upload] ${base}: ${error.message}`);
      results.push({ file: base, url: null, erro: error.message });
      continue;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    results.push({ file: base, url: pub.publicUrl });
  }
  return results;
}

function loadJsonIfExists(p) {
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

async function main() {
  const media = collectMedia();
  if (media.length === 0) {
    console.warn('[distribution] Nenhuma mídia encontrada em ads/ ou video/ — gerando MD só com o que houver.');
  }

  const mediaUrls = await uploadToSupabase(media);
  writeFileSync(path.join(taskDir, 'media_urls.json'), JSON.stringify(mediaUrls, null, 2));

  const adLayout = loadJsonIfExists(path.join(taskDir, 'ads', 'layout.json'));
  const scenes = loadJsonIfExists(path.join(taskDir, 'video', 'scenes.json'));

  const publishMdName = `Publish ${taskName} ${date}.md`;
  const lines = [];
  lines.push(`# Publish ${taskName} ${date}`);
  lines.push('');
  lines.push('**Publicação é manual.** Este arquivo é um advisory — nada é postado automaticamente.');
  lines.push('Poste com base no que está aqui somente depois de revisar contra `knowledge/brand_identity.md`');
  lines.push('e `knowledge/platform_guidelines.md`.');
  lines.push('');
  lines.push('## Mídia');
  for (const m of mediaUrls) {
    lines.push(`- \`${m.file}\` → ${m.url || '(erro no upload — ver console)'}`);
  }
  lines.push('');
  if (adLayout) {
    lines.push('## Ad estático');
    lines.push(`- Headline: "${adLayout.headline}"`);
    if (adLayout.subtext) lines.push(`- Subtexto: "${adLayout.subtext}"`);
    if (adLayout.cta) lines.push(`- CTA: "${adLayout.cta}"`);
    lines.push('');
  }
  if (scenes) {
    lines.push('## Vídeo');
    lines.push(`- ${scenes.scenes.length} scenes, formato ${scenes.width}×${scenes.height}`);
    lines.push(`- Duração total: ${scenes.scenes.reduce((s, sc) => s + (sc.durationSec || 3), 0)}s`);
    lines.push('');
  }
  lines.push('## Horários sugeridos (ver knowledge/platform_guidelines.md)');
  lines.push('- Instagram: conferir horário de maior atividade do público (executivos/donos de empresa) — sugestão inicial: horário de almoço (12h–13h) ou fim de tarde (18h–19h), dias úteis.');
  lines.push('- Threads: mesmo texto adaptado para tom técnico/seco, pode ir no mesmo dia.');
  lines.push('- YouTube: sem urgência de horário fixo — priorizar consistência semanal.');
  lines.push('');
  lines.push('## Checklist antes de postar (ver knowledge/brand_identity.md → Brand Governance)');
  lines.push('1. Paleta restrita a verde-água/laranja/branco/cinza-chumbo?');
  lines.push('2. Tipografia Fraunces + Inter (ou Georgia + Calibri)?');
  lines.push('3. Tom direto e consultivo, sem superlativo vazio?');
  lines.push('4. Cada claim tem número específico ou prova real?');
  lines.push('5. Laranja usado com parcimônia (nunca > 20% da composição)?');

  writeFileSync(path.join(taskDir, publishMdName), lines.join('\n'));
  console.log(`\nOK — gerado: ${path.join(taskDir, publishMdName)}`);
  console.log(`  media_urls.json (${mediaUrls.length} arquivo(s))`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
