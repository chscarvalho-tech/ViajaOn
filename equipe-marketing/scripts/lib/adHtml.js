// Gera HTML/CSS determinístico a partir de um layout JSON — texto, cor e logo exatos, zero
// dependência de IA generativa (ver knowledge/product_campaign.md, addendum 12/08/2026: a
// geração via Canva "generate-design" embaralhou/duplicou texto de forma consistente; HTML/CSS
// próprio não tem esse problema).
//
// Paleta e tipografia vêm de knowledge/brand_identity.md — não hardcode outra cor aqui.
const PALETTE = {
  verdeAgua: '#189898',
  laranja: '#FF943E',
  branco: '#FFFFFF',
  cinzaChumbo: '#2B2B2B',
};

const TEMPLATES = new Set(['centered_minimal', 'product_left', 'product_right']);

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// layout: { width, height, background, headline, subtext, cta, accent, logoPath, template }
export function buildAdHtml(layout) {
  const {
    width = 1080,
    height = 1080,
    background = PALETTE.branco,
    headline,
    subtext = '',
    cta = '',
    accent = PALETTE.laranja,
    logoPath = null,
    template = 'centered_minimal',
  } = layout;

  if (!headline) throw new Error('layout.headline é obrigatório — sem isso não há ad.');
  if (!TEMPLATES.has(template)) {
    throw new Error(`template "${template}" desconhecido. Use um de: ${[...TEMPLATES].join(', ')}`);
  }

  const isDarkBg = background.toLowerCase() === PALETTE.verdeAgua.toLowerCase();
  const textColor = isDarkBg ? PALETTE.branco : PALETTE.cinzaChumbo;
  const headlineColor = isDarkBg ? PALETTE.branco : PALETTE.verdeAgua;

  const logoImg = logoPath
    ? `<img class="logo" src="${logoPath.replace(/\\/g, '/')}" alt="ViajaON" />`
    : '';
  const ctaHtml = cta
    ? `<div class="cta"><span>${escapeHtml(cta)}</span></div>`
    : '';
  const subtextHtml = subtext ? `<div class="subtext">${escapeHtml(subtext)}</div>` : '';

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<div class="ad-container template-${template}">
  <div class="headline">${escapeHtml(headline)}</div>
  ${subtextHtml}
  ${ctaHtml}
  ${logoImg}
</div>
</body>
</html>`;

  const css = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
body { font-family: 'Inter', Calibri, Arial, sans-serif; }

.ad-container {
  width: ${width}px;
  height: ${height}px;
  background: ${background};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: ${Math.round(width * 0.09)}px;
  position: relative;
}

.headline {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-style: italic;
  font-size: ${Math.round(width * 0.072)}px;
  line-height: 1.15;
  color: ${headlineColor};
  max-width: 88%;
  margin-bottom: ${Math.round(width * 0.035)}px;
}

.subtext {
  font-family: 'Inter', Calibri, Arial, sans-serif;
  font-weight: 400;
  font-size: ${Math.round(width * 0.028)}px;
  color: ${textColor};
  max-width: 80%;
  margin-bottom: ${Math.round(width * 0.045)}px;
}

.cta {
  background: ${accent};
  color: ${PALETTE.branco};
  font-family: 'Inter', Calibri, Arial, sans-serif;
  font-weight: 500;
  font-size: ${Math.round(width * 0.024)}px;
  padding: ${Math.round(width * 0.02)}px ${Math.round(width * 0.035)}px;
  border-radius: 6px;
  display: inline-block;
}

.logo {
  position: absolute;
  bottom: ${Math.round(width * 0.06)}px;
  right: ${Math.round(width * 0.09)}px;
  width: ${Math.round(width * 0.16)}px;
  height: auto;
}
`;

  return { html, css };
}
