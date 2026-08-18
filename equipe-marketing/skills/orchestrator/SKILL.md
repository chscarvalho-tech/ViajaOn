---
name: orchestrator
description: Coordena o pipeline completo de conteúdo da ViajaON (research → ad creative → video → copy → distribution) a partir de um nome de campanha. Acione quando o usuário pedir "criar uma campanha", "gerar conteúdo pra ViajaON", "rodar o pipeline de marketing" ou algo equivalente.
---

# Orchestrator

Coordena as skills `marketing-research-agent`, `ad-creative-designer`, `video-ad-specialist`,
`copywriter-agent` e `distribution-agent` numa única campanha. Implementação real: uma
sequência de scripts Node locais (`scripts/run-campaign.js`), **não** BullMQ/Redis — essa era
a arquitetura-alvo original (ver `../../README.md` → "Upgrade path") mas nunca foi
implementada, e não é necessária pra rodar uma campanha de cada vez, que é o uso real até
agora. Só vale migrar pra fila de verdade se um dia precisar rodar várias campanhas em
paralelo.

## Passo 1 — Reunir o payload

Antes de rodar qualquer coisa, pergunte ao usuário (numa única mensagem, sem parecer
formulário):

1. **Nome da task** — vira o prefixo da pasta de output (`outputs/<task>_<data>/`). Use
   snake_case, ex.: `campanha_setembro`.
2. **Nicho/ângulo da pesquisa** — o que a pesquisa de mercado deve focar (default se não
   souber: "concierge de milhas e pontos para viajantes de alta renda").
3. **Pular vídeo?** — o render de vídeo local demora mais (~1min) e produz um resultado mais
   simples que o Remotion descrito no plano original (ver `video-ad-specialist/SKILL.md`).
   Perguntar se vale rodar agora ou só o ad estático.
4. **Pular pesquisa?** — só faz sentido se já existir `research_results.json` de uma rodada
   anterior pra essa task, ou se o usuário já tiver os ângulos definidos.

## Passo 2 — Rodar o pipeline

```bash
npm run campaign:run -- --task=<nome_da_task> --niche="<nicho>" [--skip-video] [--skip-research]
```

Isso executa em sequência:

1. **Research** (`marketing-research-agent`) — grava `research_results.json`, `research_brief.md`, `interactive_report.html`
2. **Ad Creative Designer** — grava `ads/layout.json`, `ads/ad.html`, `ads/styles.css`, `ads/instagram_ad.png`
3. **Video Ad Specialist** (se não pulado) — grava `video/scenes.json`, `video/ad.mp4`
4. **Distribution** — grava `media_urls.json` e `Publish <task> <data>.md`

O script para e reporta erro se qualquer passo falhar — não segue pro próximo com output
quebrado.

## Passo 3 — Copywriter (skill de prompt, roda separada)

O comando acima **não** gera copy — isso é deliberado (ver `copywriter-agent/SKILL.md`: copy
de marca precisa de julgamento editorial, não é template). Depois do passo 2, invoque a skill
`copywriter-agent` você mesmo (Claude), lendo `outputs/<task>_<data>/research_results.json` e
os knowledge files, e salve os arquivos de copy na mesma pasta (`copy/`).

## Passo 4 — Reportar pro usuário

Ao final, resuma pro usuário:

- Pasta gerada (`outputs/<task>_<data>/`)
- O que foi pulado (vídeo? pesquisa?)
- Se a pesquisa rodou em modo demo (sem `TAVILY_API_KEY`) ou real
- Se a distribuição usou Supabase real ou fallback de caminho local (sem `SUPABASE_URL`)
- Que a publicação real (Instagram/YouTube) só acontece se o usuário referenciar
  explicitamente o `Publish <task> <data>.md` pelo nome — nunca automático

## Regras

1. Nunca publique nada (Instagram/YouTube) sem o usuário citar o Publish MD pelo nome.
2. Se `--skip-research` for pedido, confira que `outputs/<task>_<data>/research_results.json`
   já existe de uma rodada anterior — se não existir, avise e não prossiga pros passos que
   dependem dele (ad creative e copy usam `content_topics`/`ad_hooks` da pesquisa).
3. Toda decisão de conteúdo (headline, ângulo, scene) deve vir de
   `knowledge/brand_identity.md` e `knowledge/product_campaign.md` — nunca invente claim sem
   número ou caso real por trás (regra da marca, não só desta skill).
