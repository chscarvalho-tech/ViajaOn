---
name: ad-creative-designer
description: Gera um criativo estático (JSON de layout + HTML/CSS + PNG renderizado) para a ViajaON, seguindo a paleta e tipografia da marca. Acione quando o usuário pedir "criar um anúncio", "gerar uma arte pro Instagram" ou similar.
---

# Ad Creative Designer

Gera um design determinístico — texto, cor e logo exatos — e renderiza pra PNG via Chrome
headless local. **Não usa IA generativa pra texto em imagem**: a campanha "Alinhamento de
Milhas" (12/08/2026, ver addendum em `../../knowledge/product_campaign.md`) tentou isso via
Canva `generate-design` e o texto saiu embaralhado/duplicado, com nome de fonte vazando como
texto visível, de forma consistente em várias tentativas. HTML/CSS próprio não tem esse
problema.

## Como rodar

```bash
node scripts/render-ad.js --task=<nome_da_task> [--layout=caminho/layout.json]
```

Sem `--layout`, usa um exemplo real do Conceito 1 de `knowledge/product_campaign.md`
("Milha Parada Não É Economia"). Grava em `outputs/<task>_<data>/ads/`:

- `layout.json` — a especificação de design
- `ad.html` + `styles.css` — o HTML gerado
- `instagram_ad.png` — screenshot 1080×1080 via Chrome headless

## Como montar um layout.json novo

Antes de escrever um, leia `knowledge/brand_identity.md` (paleta, tipografia, regras de
contraste) e `knowledge/product_campaign.md` (selling points, ordem de prioridade de
campanha). Depois monte:

```json
{
  "format": "instagram_square",
  "width": 1080,
  "height": 1080,
  "template": "centered_minimal",
  "background": "#189898",
  "headline": "Você já pagou por essa viagem.",
  "subtext": "Falta só ir.",
  "cta": "Fale com a ViajaON",
  "accent": "#FF943E",
  "logoPath": "caminho/absoluto/pra/assets/viajaon_logo_transparent.png"
}
```

Regras não-negociáveis (ver `scripts/lib/adHtml.js`, que aplica isso automaticamente):

- **Cores**: só `#189898` (verde-água), `#FF943E` (laranja), `#FFFFFF` (branco),
  `#2B2B2B` (cinza-chumbo). Laranja nunca passa de ~20% da composição, e nunca fica sobre
  verde-água (contraste baixo demais).
- **Logo**: use sempre `viajaon_logo_transparent.png`, nunca `viajaon_logo.png` — esse
  segundo tem fundo branco opaco embutido no arquivo (bug documentado no addendum de
  `brand_identity.md`) e cria um "cartão" branco visível sobre qualquer fundo colorido.
- **Tipografia**: Fraunces pra headline (carregada via Google Fonts, com fallback pra
  Georgia se a máquina renderizar sem internet), Inter pro resto.
- **Claim sem número ou caso real não entra** — regra universal da marca
  (`brand_identity.md` → Voice & Tone).

`template` aceita `centered_minimal` hoje (implementado e testado). `product_left` e
`product_right` estão listados no schema mas **não implementados ainda** —
`buildAdHtml` lança erro claro se usados; implemente se/quando precisar de layout com foto de
produto/cliente ao lado do texto (ver "Assets Pendentes de Produção" em
`product_campaign.md` — ainda não há foto real de cliente autorizada pra usar aí).

## Formatos por plataforma (ver `knowledge/platform_guidelines.md`)

| Formato | width × height |
|---|---|
| Instagram Post | 1080 × 1080 |
| Instagram Carrossel / Feed 4:5 | 1080 × 1350 |
| Instagram Story/Reel | 1080 × 1920 |
| YouTube Thumbnail | 1280 × 720 |

## Sobre fotografia real

`brand_identity.md` registra um conflito não resolvido: o guia pede só tipografia/ícones até
existir foto real de cliente autorizada, mas os Reels reais da marca já usam foto de banco de
imagem de destino. Esta skill, por padrão, segue a regra mais conservadora (só
tipografia + paleta), que é o que `centered_minimal` implementa. Se o Luís confirmar que
quer seguir o estilo do Reels real, isso vira um novo `template` com `<img>` de fundo — ainda
não implementado.
