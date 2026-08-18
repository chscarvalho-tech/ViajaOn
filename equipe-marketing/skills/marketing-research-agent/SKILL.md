---
name: marketing-research-agent
description: Roda pesquisa de mercado estruturada (tendências, concorrentes, audiência, hooks, tópicos virais) para a ViajaON via Tavily, e sintetiza num JSON machine-readable consumido pelos outros agentes. Acione quando o usuário pedir "pesquisar mercado", "atualizar research da ViajaON" ou como primeiro passo de uma campanha nova.
---

# Marketing Research Agent

Gera inteligência de mercado estruturada — não uma lista solta de ideias — pra alimentar
`ad-creative-designer`, `video-ad-specialist` e `copywriter-agent`.

## Como rodar

```bash
node scripts/research.js --task=<nome_da_task> --niche="<nicho, opcional>"
```

Faz 5 buscas Tavily direcionadas (tendências, concorrentes, audiência, hooks, tópicos virais)
sobre o nicho informado (default: "concierge de milhas e pontos para viajantes de alta
renda") e grava, em `outputs/<task>_<data>/`:

- `research_results.json` — dados estruturados (content_topics, marketing_angles, keywords,
  ad_hooks, video_concepts + achados brutos por busca)
- `research_brief.md` — versão legível em Markdown
- `interactive_report.html` — relatório HTML simples (tabela de buscas + hooks), sem
  dependência de CDN externo

## Sem TAVILY_API_KEY configurada

O script roda em **modo demo**: gera a mesma estrutura de JSON/MD/HTML, mas cada item vem
marcado `"fonte": "demo"` em vez de dados reais de busca. Isso existe pra não travar o resto
do pipeline enquanto a chave não está configurada — nunca apresente um resultado demo como se
fosse pesquisa real pro usuário. Avise sempre que `research_results.json.fonte === "demo"`.

Pra pesquisa real: crie uma conta em tavily.com, gere uma API key, e coloque em
`TAVILY_API_KEY` no `.env` (ver `.env.example`).

## O que fazer com o resultado

Depois de rodar, leia `research_results.json` e:

1. Escolha **um único ângulo de campanha** consistente entre `marketing_angles` — esse ângulo
   deve se manter igual no ad estático, no vídeo e em toda a copy (ver
   `copywriter-agent/SKILL.md`, Regra 3).
2. Confira `ad_hooks` contra `knowledge/brand_identity.md` — todo hook precisa de número ou
   caso real por trás (regra universal da marca, não é sugestão).
3. Repasse `content_topics` e `keywords` pro copywriter quando invocar aquela skill.

## Extensão futura (não implementada)

O CLAUDE.md original do pipeline descreve gráficos Mermaid no brief e um dashboard Chart.js
no relatório interativo — a versão atual (`research.js`) gera Markdown/HTML simples, sem essas
duas coisas. Adicionar depois se fizer falta; não é bloqueio pra rodar o pipeline hoje.
