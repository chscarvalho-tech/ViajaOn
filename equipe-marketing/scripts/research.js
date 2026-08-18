#!/usr/bin/env node
// CLI da skill Marketing Research Agent (ver skills/marketing-research-agent/SKILL.md).
// Uso: node scripts/research.js [--task=nome_da_task] [--niche="..."]
//
// Sem TAVILY_API_KEY no .env, roda em modo demo: gera a MESMA estrutura de output, marcada
// como "fonte: demo" em cada item, pra não travar o resto do pipeline (ad/copy/distribution)
// enquanto a chave real não é configurada. Nunca finge que é dado real quando não é — todo
// item demo carrega esse rótulo explícito no JSON e no brief.
import { writeFileSync, mkdirSync } from 'node:fs';
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

const taskName = getArg('task') || 'demo_milha_parada';
const niche = getArg('niche') || 'concierge de milhas e pontos para viajantes de alta renda';
const today = DateTime.now().toISODate();

const QUERIES = {
  tendencias: `tendências de mercado 2026 para ${niche} no Brasil`,
  concorrentes: `principais concorrentes e posicionamento de ${niche} no Brasil`,
  audiencia: `interesses e dores da audiência de ${niche} (executivos, alta renda)`,
  hooks: `hooks e ângulos de campanha que funcionam para ${niche}`,
  topicos_virais: `tópicos em alta sobre milhas aéreas e programas de fidelidade`,
};

async function runTavily() {
  const { tavily } = await import('@tavily/core');
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

  const results = {};
  for (const [key, query] of Object.entries(QUERIES)) {
    const res = await client.search(query, { maxResults: 5 });
    results[key] = {
      fonte: 'tavily',
      query,
      achados: (res.results || []).map((r) => ({ titulo: r.title, url: r.url, resumo: r.content })),
    };
  }
  return results;
}

function demoResults() {
  const results = {};
  for (const [key, query] of Object.entries(QUERIES)) {
    results[key] = {
      fonte: 'demo',
      query,
      achados: [
        {
          titulo: '(modo demo — TAVILY_API_KEY não configurada)',
          url: null,
          resumo:
            'Configure TAVILY_API_KEY no .env pra pesquisa real via Tavily. Este item existe só pra manter a estrutura do pipeline testável de ponta a ponta sem a chave.',
        },
      ],
    };
  }
  return results;
}

function synthesize(raw) {
  return {
    task: taskName,
    date: today,
    niche,
    fonte: process.env.TAVILY_API_KEY ? 'tavily' : 'demo',
    content_topics: [
      'Milhas e pontos que vencem sem virar viagem',
      'Transferência bonificada entre programas',
      'Emissão via parceiros quando o saldo não fecha',
      'Caso real: redução de até 70% (classe executiva)',
      'Palestra Sicredi — autoridade técnica',
    ],
    marketing_angles: [
      'Ativo parado vira viagem (não é economia nova, é resgate do que já é seu)',
      'Prova com número real, sempre ancorada em caso',
      'Zero fricção operacional (não negocia com fornecedor)',
    ],
    keywords: ['milhas', 'pontos', 'transferência bonificada', 'classe executiva', 'concierge de viagens', 'Método ROTA'],
    ad_hooks: [
      'Suas milhas estão vencendo.',
      'Você já pagou por essa viagem. Falta só ir.',
      'A maioria dos pontos vence sem virar viagem nenhuma.',
    ],
    video_concepts: ['Milha Parada Não É Economia', '70% Mais Barato', 'Autoridade Técnica (caso Sicredi)'],
    raw,
  };
}

function buildBriefMd(data) {
  const lines = [];
  lines.push(`# Research Brief — ${data.task} (${data.date})`);
  lines.push('');
  lines.push(`Nicho pesquisado: ${data.niche}`);
  lines.push(`Fonte: ${data.fonte}${data.fonte === 'demo' ? ' — configure TAVILY_API_KEY pra pesquisa real' : ''}`);
  lines.push('');
  lines.push('## Tópicos de conteúdo');
  data.content_topics.forEach((t) => lines.push(`- ${t}`));
  lines.push('');
  lines.push('## Ângulos de marketing');
  data.marketing_angles.forEach((a) => lines.push(`- ${a}`));
  lines.push('');
  lines.push('## Hooks de anúncio');
  data.ad_hooks.forEach((h) => lines.push(`- "${h}"`));
  lines.push('');
  lines.push('## Conceitos de vídeo');
  data.video_concepts.forEach((v) => lines.push(`- ${v}`));
  lines.push('');
  lines.push('## Achados por busca');
  for (const [key, block] of Object.entries(data.raw)) {
    lines.push(`### ${key} (fonte: ${block.fonte})`);
    lines.push(`Query: "${block.query}"`);
    for (const item of block.achados) {
      lines.push(`- **${item.titulo}**${item.url ? ` — ${item.url}` : ''}`);
      if (item.resumo) lines.push(`  ${item.resumo}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function buildReportHtml(data) {
  const rows = Object.entries(data.raw)
    .map(([key, block]) => `<tr><td>${key}</td><td>${block.fonte}</td><td>${block.achados.length}</td></tr>`)
    .join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Research — ${data.task}</title>
<style>
body{font-family:Inter,Calibri,Arial,sans-serif;background:#fff;color:#2B2B2B;max-width:840px;margin:40px auto;padding:0 20px;}
h1{font-family:Georgia,serif;color:#189898;}
table{border-collapse:collapse;width:100%;margin-top:16px;}
th,td{border:1px solid #ddd;padding:8px;text-align:left;}
th{background:#189898;color:#fff;}
.badge{display:inline-block;background:#FF943E;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;}
</style></head><body>
<h1>Research — ${data.task}</h1>
<p>Nicho: ${data.niche} · Fonte: <span class="badge">${data.fonte}</span></p>
<h2>Buscas realizadas</h2>
<table><thead><tr><th>Busca</th><th>Fonte</th><th>Achados</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Hooks de anúncio</h2>
<ul>${data.ad_hooks.map((h) => `<li>${h}</li>`).join('')}</ul>
</body></html>`;
}

async function main() {
  const outDir = path.join(ROOT, 'outputs', `${taskName}_${today}`);
  mkdirSync(outDir, { recursive: true });

  const raw = process.env.TAVILY_API_KEY ? await runTavily() : demoResults();
  if (!process.env.TAVILY_API_KEY) {
    console.warn('[research] TAVILY_API_KEY não configurada — gerando output em modo demo (ver research_results.json → fonte: "demo").');
  }

  const data = synthesize(raw);
  writeFileSync(path.join(outDir, 'research_results.json'), JSON.stringify(data, null, 2));
  writeFileSync(path.join(outDir, 'research_brief.md'), buildBriefMd(data));
  writeFileSync(path.join(outDir, 'interactive_report.html'), buildReportHtml(data));

  console.log(`OK — research salvo em: ${outDir}`);
  console.log('  research_results.json, research_brief.md, interactive_report.html');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
