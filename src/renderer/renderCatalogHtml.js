import {
  catalogCssVars,
  cleanStyle,
  DEFAULT_FONT,
  elementContentStyles,
  elementFrameStyle,
  googleFontsUrl,
  pageStyle,
  sortElements,
  TEXT_TYPES,
} from '../shared/renderModel.js';
import { escapeHtml } from '../utils/strings.js';
import { printImageUrl } from './printImages.js';

const toKebab = (key) => (key.startsWith('--') ? key : key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`));

/** { fontSize: '12pt' } → 'font-size:12pt' (escapado para atributo HTML). */
export function styleToCss(style) {
  return Object.entries(cleanStyle(style))
    .map(([key, value]) => `${toKebab(key)}:${value}`)
    .join(';');
}

const attr = (style) => escapeHtml(styleToCss(style));

function renderElementContent(el) {
  const { kind, content, inner } = elementContentStyles(el);
  const contentAttr = attr(content);

  if (kind === 'text') {
    return `<div class="el-content" style="${contentAttr}"><div class="el-text" style="${attr(inner)}">${escapeHtml(el.content || '')}</div></div>`;
  }
  if (kind === 'image') {
    const img = el.image?.url
      ? `<img src="${escapeHtml(printImageUrl(el.image.url, el))}" alt="${escapeHtml(el.image.name || '')}" style="${attr(inner)}">`
      : '';
    return `<div class="el-content" style="${contentAttr}">${img}</div>`;
  }
  if (kind === 'line') {
    return `<div class="el-content" style="${contentAttr}"><div style="${attr(inner)}"></div></div>`;
  }
  return `<div class="el-content" style="${contentAttr}"></div>`;
}

function renderElement(el) {
  return `<div class="el el-${escapeHtml(el.type)}" data-id="${escapeHtml(el.id)}" style="${attr(elementFrameStyle(el))}">${renderElementContent(el)}</div>`;
}

function renderMarginGuides(catalog) {
  const style = {
    position: 'absolute',
    left: `${catalog.marginLeft}mm`,
    top: `${catalog.marginTop}mm`,
    right: `${catalog.marginRight}mm`,
    bottom: `${catalog.marginBottom}mm`,
  };
  return `<div class="margin-guides" style="${attr(style)}"></div>`;
}

function renderPage(page, catalog, size, index, options) {
  const elements = sortElements(page.elements).filter((el) => !el.hidden);
  const guides = options.showGuides ? renderMarginGuides(catalog) : '';
  const label = options.mode === 'preview' ? `<div class="page-label">Página ${index + 1}</div>` : '';
  return `${label}<section class="page" data-page="${index + 1}" style="${attr(pageStyle(page, size))}">${elements.map(renderElement).join('')}${guides}</section>`;
}

/** Familias tipográficas realmente usadas (para no cargar fuentes innecesarias). */
export function usedFontFamilies(catalog) {
  const families = new Set([DEFAULT_FONT]);
  for (const page of catalog.pages || []) {
    for (const el of page.elements || []) {
      if (TEXT_TYPES.includes(el.type) && el.fontFamily) families.add(el.fontFamily);
    }
  }
  return [...families];
}

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision}
.page{break-after:page;page-break-after:always;break-inside:avoid}
.page:last-of-type{break-after:auto;page-break-after:auto}
.margin-guides{display:none}
@media screen{
  body{background:#E5E7EB;padding:24px 16px 48px;font-family:Inter,sans-serif}
  .page{margin:0 auto 32px;box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 24px rgba(0,0,0,.08)}
  .page-label{margin:0 auto 8px;text-align:center;font:500 12px/1 Inter,sans-serif;color:#6B7280;letter-spacing:.02em}
  .margin-guides{display:block;border:1px dashed rgba(246,72,81,.7);pointer-events:none;z-index:100000}
}
@media print{.page-label,.margin-guides{display:none!important}}
`;

/**
 * Genera el HTML del catálogo a partir de los datos guardados.
 * Es la única implementación del renderizado final: se usa para la vista
 * previa (modo "preview") y para el PDF (modo "print").
 *
 * @param {object} catalog Catálogo serializado (con pageWidth/pageHeight, pages, elements, image).
 * @param {{ mode?: 'print'|'preview', showGuides?: boolean }} options
 */
export function renderCatalogHtml(catalog, options = {}) {
  const opts = { mode: 'print', showGuides: false, ...options };
  const size = { width: catalog.pageWidth, height: catalog.pageHeight };
  const pages = (catalog.pages || []).map((page, index) => renderPage(page, catalog, size, index, opts)).join('\n');
  const rootVars = styleToCss(catalogCssVars(catalog));

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(catalog.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${escapeHtml(googleFontsUrl(usedFontFamilies(catalog)))}">
<style>
@page{size:${size.width}mm ${size.height}mm;margin:0}
:root{${rootVars}}
${BASE_CSS}
</style>
</head>
<body>
${pages}
</body>
</html>`;
}
