---
name: video-ad-specialist
description: Gera um vídeo curto (scene JSON + .mp4 renderizado) para a ViajaON a partir de um conceito de campanha. Acione quando o usuário pedir "criar um vídeo", "gerar um Reels" ou similar.
---

# Video Ad Specialist

**Aviso de arquitetura, leia antes de usar:** `knowledge/product_campaign.md` descreve
Remotion (React + SVG, animação word-by-word via `useCurrentFrame()`) como a engine de
rendering de vídeo. Isso **nunca foi implementado** neste projeto. O que existe e funciona de
verdade hoje (`scripts/render-video.js`) é a via comprovada no addendum daquele mesmo
arquivo: cada scene vira um frame estático (HTML/CSS + Chrome headless, mesma técnica do
`ad-creative-designer`), e o ffmpeg aplica fade in/out e concatena os clipes. **Não há
animação de texto word-by-word real nesta versão** — é fade em frame estático, não o
"spring sutil" descrito no Motion Style do brand doc. Documentando essa diferença aqui pra
ninguém prometer ao cliente uma animação que o script não produz.

## Como rodar

```bash
node scripts/render-video.js --task=<nome_da_task> [--scenes=caminho/scenes.json]
```

Sem `--scenes`, usa o Conceito 1 de `knowledge/product_campaign.md` ("Milha Parada Não É
Economia", 20s, 1080×1350). Grava em `outputs/<task>_<data>/video/`:

- `scenes.json` — a especificação de scenes
- `frames/sceneN.png` + `frames/sceneN.mp4` — frame e clipe individual de cada scene
- `ad.mp4` — vídeo final concatenado

## Como montar um scenes.json novo

```json
{
  "width": 1080,
  "height": 1350,
  "logoPath": "caminho/absoluto/pra/assets/viajaon_logo_transparent.png",
  "scenes": [
    { "type": "hook", "text": "Suas milhas estão vencendo.", "durationSec": 3 },
    { "type": "problem", "text": "...", "durationSec": 4 },
    { "type": "turn", "text": "...", "durationSec": 4 },
    { "type": "proof", "text": "...", "durationSec": 4 },
    { "type": "cta", "text": "...", "durationSec": 5, "background": "#189898" }
  ]
}
```

`type` controla estilo automático (ver `scripts/lib/sceneHtml.js`): `hook` e `cta` usam
itálico e fundo/texto de destaque; `problem`/`turn`/`proof` usam fundo branco, texto
cinza-chumbo. `cta` mostra o logo (nas outras scenes o logo fica com opacidade 0 — pra não
repetir logo em toda tela).

Regras de conteúdo (`knowledge/product_campaign.md` → Motion Style e Do's & Don'ts):

- Cada scene beat: 2–4 segundos. Total do ad: 15–30 segundos.
- Nunca hard cut — o fade in/out do `render-video.js` cumpre isso na versão local.
- Termine sempre com CTA em tom consultivo, nunca "fade to black" sem próximo passo.

## Formatos por plataforma

| Formato | width × height |
|---|---|
| Feed 4:5 | 1080 × 1350 |
| Story/Reel | 1080 × 1920 |
| YouTube | 1920 × 1080 |

## Quando migrar pra Remotion de verdade

Vale o investimento se/quando: (a) o cliente pedir animação word-by-word real, ou (b) volume
de vídeos justificar o setup de um projeto React. Nesse ponto, `scenes.json` já é quase o
formato certo de entrada — a mudança fica no renderer (`render-video.js` → projeto Remotion),
não na estrutura de dados desta skill.
