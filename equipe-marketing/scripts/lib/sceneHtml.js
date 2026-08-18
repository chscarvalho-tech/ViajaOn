// Gera HTML/CSS de um frame estático por scene de vídeo — mesma técnica determinística do
// ad-creative-designer (ver adHtml.js), reaproveitada aqui porque é o que realmente renderiza
// texto sem embaralhar (ver addendum de knowledge/product_campaign.md). Cada scene vira UM
// frame estático; a sensação de movimento vem do fade in/out aplicado depois pelo ffmpeg
// (ver render-video.js) — não há animação word-by-word real nesta versão local (isso pediria
// Remotion + React, que é o caminho documentado em knowledge/product_campaign.md como
// arquitetura-alvo; ver skills/video-ad-specialist/SKILL.md para quando migrar pra lá).
const PALETTE = { verdeAgua: '#189898', laranja: '#FF943E', branco: '#FFFFFF', cinzaChumbo: '#2B2B2B' };

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// scene: { type: 'hook'|'problem'|'turn'|'proof'|'cta', text, background?, logo? }
export function buildSceneHtml(scene, { width = 1080, height = 1350, logoPath = null } = {}) {
  const { type, text, background } = scene;
  if (!text) throw new Error(`scene do tipo "${type}" sem "text" — toda scene precisa de texto.`);

  const isCta = type === 'cta';
  const bg = background || (isCta ? PALETTE.verdeAgua : PALETTE.branco);
  const isDark = bg.toLowerCase() === PALETTE.verdeAgua.toLowerCase();
  const textColor = isDark ? PALETTE.branco : PALETTE.cinzaChumbo;
  const headlineColor = isDark ? PALETTE.branco : PALETTE.verdeAgua;
  const italic = isCta || type === 'hook';

  const logoImg = logoPath ? `<img class="logo" src="${logoPath.replace(/\\/g, '/')}" alt="ViajaON" />` : '';

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;1,600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="scene.css" /></head>
<body>
<div class="scene">
  <div class="text${italic ? ' italic' : ''}">${escapeHtml(text)}</div>
  ${logoImg}
</div>
</body></html>`;

  const css = `
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${width}px; height:${height}px; overflow:hidden; }
.scene {
  width:${width}px; height:${height}px; background:${bg};
  display:flex; align-items:center; justify-content:center; padding:${Math.round(width * 0.12)}px;
  position:relative;
}
.text {
  font-family:'Fraunces', Georgia, serif; font-weight:600;
  font-size:${Math.round(width * 0.09)}px; line-height:1.2; text-align:center;
  color:${type === 'hook' || type === 'cta' ? headlineColor : textColor};
}
.text.italic { font-style: italic; }
.logo { position:absolute; bottom:${Math.round(width * 0.05)}px; width:${Math.round(width * 0.18)}px; height:auto; opacity:${isCta ? 1 : 0}; }
`;

  return { html, css };
}
