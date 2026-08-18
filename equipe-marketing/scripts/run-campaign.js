#!/usr/bin/env node
// CLI da skill Orchestrator (ver skills/orchestrator/SKILL.md).
// Uso: node scripts/run-campaign.js --task=nome_da_task [--niche="..."] [--skip-video] [--skip-research]
//
// Roda o pipeline como uma sequência simples de processos Node — SEM BullMQ/Redis. A
// arquitetura-alvo documentada em CLAUDE.md (fila de jobs, execução paralela) é um upgrade
// path real, não um requisito pra rodar hoje: pra uma campanha de cada vez (o caso de uso
// real da ViajaON até aqui), execução sequencial local é mais simples de instalar, depurar e
// rodar na máquina do cliente, sem depender de conta paga no Upstash. Ver README para quando
// migrar pra fila de verdade.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const taskName = getArg('task');
if (!taskName) {
  console.error('Uso: node scripts/run-campaign.js --task=nome_da_task [--niche="..."] [--skip-video] [--skip-research]');
  process.exit(1);
}
const niche = getArg('niche');
const skipVideo = hasFlag('skip-video');
const skipResearch = hasFlag('skip-research');

function step(label, file, extraArgs = []) {
  console.log(`\n=== ${label} ===`);
  const scriptArgs = [path.join(ROOT, 'scripts', file), `--task=${taskName}`, ...extraArgs];
  execFileSync(process.execPath, scriptArgs, { stdio: 'inherit', cwd: ROOT });
}

if (!skipResearch) {
  step('1/4 Research', 'research.js', niche ? [`--niche=${niche}`] : []);
} else {
  console.log('\n=== 1/4 Research — pulado (--skip-research) ===');
}

step('2/4 Ad Creative Designer', 'render-ad.js');

if (!skipVideo) {
  step('3/4 Video Ad Specialist', 'render-video.js');
} else {
  console.log('\n=== 3/4 Video Ad Specialist — pulado (--skip-video) ===');
}

// Copywriter Agent é uma skill de prompt (ver skills/copywriter-agent/SKILL.md) — Claude gera
// os textos direto na conversa, referenciando knowledge/ e research_results.json. Não há
// script de linha de comando pra esse passo por decisão de design: copy de marca precisa de
// julgamento editorial, não é um template pra preencher — ver o SKILL.md pra instruções
// completas de como Claude deve fazer isso quando invocado.
console.log('\n=== Copywriter Agent — rode a skill copywriter-agent no Claude Code, referenciando research_results.json ===');

step('4/4 Distribution (Publish MD)', 'distribute.js');

console.log(`\nPipeline concluído para "${taskName}". Ver outputs/${taskName}_<data>/`);
