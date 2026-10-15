# equipe-viajaon-marketing

Pipeline de automação de conteúdo (research → ad creative → video → copy → distribution) para
a marca **ViajaON**, empacotado como plugin de skills do Claude Code
(`.claude-plugin/plugin.json` + `skills/*/SKILL.md`, mesmo padrão do
`cowork-starter-pack`).

## Contexto — leia isto antes de qualquer coisa

Este projeto nasceu de uma pasta (`Agentes_Claude/Equipe de Marketing/Equipe ViajaOn`) que
continha só documentação: knowledge files da marca (brand identity, product/campaign,
platform guidelines), prompts de curso e os outputs de UMA campanha real feita manualmente
("Alinhamento de Milhas", 12/08/2026). O `CLAUDE.md` daquela pasta descrevia uma arquitetura
completa — 5 agentes, orchestrator, BullMQ + Upstash Redis, Playwright, Supabase, Instagram
Graph API, YouTube Data API — mas o próprio arquivo admitia num addendum que **nada disso
estava implementado**: era a especificação-alvo de um curso, não código funcionando.

Este repositório implementa de verdade a versão que roda numa máquina Windows comum, sem
infraestrutura paga obrigatória, seguindo o padrão que a campanha real comprovou funcionar
(HTML/CSS + Chrome headless + ffmpeg, documentado no addendum de
`knowledge/product_campaign.md`) em vez da arquitetura de nuvem aspiracional. **Testei os
scripts de ad e vídeo de ponta a ponta nesta máquina antes de considerar isso pronto** — não
é código não verificado.

## O que funciona hoje, testado

| Skill | Script | Testado? | Dependência externa |
|---|---|---|---|
| Ad Creative Designer | `scripts/render-ad.js` | ✅ gera PNG real | Nenhuma (Chrome local) |
| Video Ad Specialist | `scripts/render-video.js` | ✅ gera MP4 real | Nenhuma (Chrome + ffmpeg locais) |
| Distribution | `scripts/distribute.js` | ✅ gera Publish MD | Opcional: Supabase (senão, fallback local) |
| Marketing Research | `scripts/research.js` | ✅ roda, em modo demo | Opcional: Tavily (senão, modo demo) |
| Copywriter | skill de prompt, sem script | — | Nenhuma (Claude escreve na hora) |
| Orchestrator | `scripts/run-campaign.js` | ✅ roda o pipeline completo | — |

Rodei `npm run campaign:run -- --task=teste_pipeline` nesta máquina: gerou ad PNG, vídeo MP4
de 20s e Publish MD reais, sem erro. Sem chave de Tavily/Supabase configurada, os passos
correspondentes caem em modo demo/fallback em vez de travar — isso é comportamento esperado,
não bug.

## Instalação

```
npm install
cp .env.example .env    # opcional — preencha TAVILY_API_KEY e/ou SUPABASE_* se tiver
```

Precisa de **Google Chrome** instalado (caminho padrão do Windows já é detectado
automaticamente — ver `scripts/lib/chrome.js`) e **ffmpeg** no PATH (`winget install
Gyan.FFmpeg` se não tiver).

## Rodar uma campanha

```
npm run campaign:run -- --task=nome_da_campanha --niche="descrição do público/nicho"
```

Ou passo a passo — ver cada `skills/*/SKILL.md` pra detalhe de uso e regras de conteúdo:

```
npm run research -- --task=nome
npm run render:ad -- --task=nome
npm run render:video -- --task=nome
npm run distribute -- --task=nome
```

Tudo grava em `outputs/<task>_<data>/`.

## Estrutura

```
knowledge/           brand_identity.md, product_campaign.md, platform_guidelines.md — fonte
                      da verdade pra todo conteúdo gerado (copiados de Equipe ViajaOn);
                      instagram_skills.md — uso das skills globais ig-* nesta equipe
assets/               logo, paleta, foto do Luís (porta-voz) — copiados de Equipe ViajaOn
skills/*/SKILL.md    instruções de cada skill pro Claude Code (clone-luis-viajaon = voz do
                      Luís e revisão final aplicada a todas as outras)
scripts/              implementação real: research, render-ad, render-video, distribute,
                      run-campaign (orchestrator sequencial)
scripts/lib/          Chrome headless, ffmpeg, geração de HTML determinístico
outputs/              gerado por cada rodada — não editar à mão
```

## O que falta pra rodar em produção de verdade

- **`TAVILY_API_KEY`** — sem isso, toda pesquisa de mercado é modo demo (dados de exemplo, não reais).
- **`SUPABASE_URL`/`SUPABASE_SERVICE_KEY`** — sem isso, mídia não sai da máquina local (fallback `file:///`, não é URL pública, não serve pra Instagram Graph API puxar).
- **Foto real de cliente autorizada** — `knowledge/product_campaign.md` registra que isso ainda não existe no acervo (só a foto do Luís, que é da equipe). Sem isso, `ad-creative-designer` fica limitado ao template `centered_minimal` (só tipografia + paleta).
- **Decisão sobre o conflito brand guide vs. Reels real** — `brand_identity.md` e `platform_guidelines.md` registram que o guia pede fundo branco/verde-água + Fraunces, mas os Reels reais usam foto de destino + tipografia bold sem serifa. Esta implementação segue o guia (mais conservador); ajustar se o Luís decidir formalizar o estilo do Reels.
- **Publicação real via API** — Instagram Graph API e YouTube Data API não estão integradas (precisam de app/OAuth que não existe nesta sessão). `distribution-agent` só gera o advisory MD.

## Upgrade path (não implementado, não bloqueia o uso hoje)

Se um dia o volume de campanhas justificar: trocar `scripts/run-campaign.js` (sequencial) por
fila real (BullMQ + Upstash Redis), e `render-video.js` (Chrome headless + ffmpeg) por um
projeto Remotion de verdade (React + `useCurrentFrame()`, animação word-by-word). Nenhum dos
dois é necessário pra rodar uma campanha de cada vez, que é o uso real até agora.
