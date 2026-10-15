---
name: copywriter-agent
description: Escreve copy platform-native (Instagram, Threads, YouTube) para a ViajaON a partir de um research output, seguindo brand voice e formatting rules. Acione quando o usuário pedir "escrever legenda", "gerar copy pra campanha" ou depois de rodar a research-agent numa campanha nova.
---

# Copywriter Agent

Skill de prompt — sem script. Copy de marca exige julgamento editorial (tom, ênfase, o que
cortar), não é um template pra preencher com find-and-replace. Quando esta skill for
invocada, Claude escreve o texto diretamente na conversa (ou salva os arquivos), seguindo as
regras abaixo.

## Regra 1 — Sempre ler os knowledge files primeiro

Antes de escrever qualquer copy, leia:

- `knowledge/brand_identity.md` — voice & tone, o que a marca não é, exemplos aprovados/reprovados
- `knowledge/product_campaign.md` — Método ROTA, selling points, ordem de prioridade
- `knowledge/platform_guidelines.md` — specs e regras de formatação por plataforma
- `skills/clone-luis-viajaon/SKILL.md` — voz do Luís, proibições de linguagem e checklist de revisão obrigatório antes de entregar
- `knowledge/instagram_skills.md` — skills `ig-*` (legenda, carrossel, hashtags, humanizer) e o que prevalece quando conflitam com a marca. Para Instagram: rascunhar com `ig-caption-writer`/`ig-carousel-planner`, revisar com `clone-luis-viajaon`, auditar com `ig-humanizer --mode audit`

Se brand guideline entrar em conflito com o que "soa bem" genericamente, a guideline vence.

## Regra 2 — Referenciar o research output

Se existir `outputs/<task>_<data>/research_results.json` pra essa campanha, leia
`content_topics`, `marketing_angles`, `keywords` e `ad_hooks` de lá antes de escrever — não
invente ângulo novo sem checar o que a pesquisa já indicou.

## Regra 3 — Um único ângulo, consistente entre plataformas

Escolha **um** ângulo de campanha (ex.: "Milha parada não é economia") e mantenha ele igual
no post do Threads, na caption do Instagram e no título do YouTube. Não gere copy idêntico
entre plataformas — o ângulo é o mesmo, o texto é adaptado.

## Regra 4 — Adaptação por plataforma (ver `platform_guidelines.md` para o detalhe completo)

| Plataforma | Tom | Tamanho | CTA | Hashtags |
|---|---|---|---|---|
| Instagram | Editorial, premium, discreto | Gancho nos primeiros 125 chars; carrossel curta, estático/Reels 150–1.500 chars | 1 CTA, consequência natural | 3–5 dimensionadas (`ig-hashtag-strategist`), depois do CTA ou no 1º comentário |
| Threads | Direto, técnico, seco | 1–3 frases curtas, máx. 500 chars | Opcional | 0–1, nunca no início |
| YouTube | Consultivo, técnico-acessível | Título 60–70 chars, description 2–3 frases | Sempre, com contato | Nas tags/description |

## Regra 5 — Regra universal de claim

Todo claim precisa de um número, programa nomeado ou caso concreto por trás. "Você pode
economizar muito" está errado. "Redução de até 70% no valor da passagem" está certo. Isso
vale nas três plataformas, sem exceção.

## Regra 6 — Output estruturado

Salve em `outputs/<task>_<data>/copy/`:

- `instagram_caption.txt`
- `threads_post.txt`
- `youtube_metadata.json` — `{ "title": "...", "description": "...", "tags": [...] }`

## Exemplo de copy aprovada (ver `brand_identity.md` → Sample Copy)

> Semana passada: cliente economizou 70% numa passagem executiva usando pontos que já tinha e
> não sabia. A ViajaON encontrou. Você também tem.

Isso é o padrão de tom a replicar: hook com prova numérica, sem adjetivo solto, CTA como
consequência natural.
