/**
 * ============================================================================
 *  MODELO DE RENDERIZADO COMPARTIDO (editor ⇄ vista previa ⇄ PDF)
 * ============================================================================
 *  Este archivo existe en DOS lugares y debe ser idéntico:
 *    - backend/src/shared/renderModel.js   (renderer HTML → PDF)
 *    - frontend/src/shared/renderModel.js  (editor visual)
 *  El test backend/tests/sharedModel.test.js falla si difieren.
 *  Tras editarlo, copia el archivo:  npm run sync:shared  (desde /backend)
 *
 *  Reglas:
 *    - Sin imports ni dependencias (JavaScript puro).
 *    - Todas las medidas en mm; tipografías en pt. Nunca px.
 *    - Devuelve objetos de estilo en camelCase (formato React). El backend
 *      los convierte a CSS en línea.
 * ============================================================================
 */

/** Tokens de color → variables CSS definidas con los colores del catálogo. */
export const COLOR_TOKENS = {
  primary: '--color-primary',
  secondary: '--color-secondary',
  text: '--color-text',
  background: '--color-background',
};

export const FONTS = [
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Oswald', category: 'sans-serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Lora', category: 'serif' },
];

export const DEFAULT_FONT = 'Inter';

// Pesos publicados en Google Fonts para cada familia (las demás: 300–800).
const DEFAULT_WEIGHTS = [300, 400, 500, 600, 700, 800];
const WEIGHTS_BY_FAMILY = {
  Lato: [300, 400, 700],
  Merriweather: [300, 400, 700],
  Oswald: [300, 400, 500, 600, 700],
  Lora: [400, 500, 600, 700],
};
const NO_ITALIC = ['Oswald'];

export const ELEMENT_TYPES = ['title', 'subtitle', 'text', 'textBlock', 'image', 'line', 'rectangle'];
export const TEXT_TYPES = ['title', 'subtitle', 'text', 'textBlock'];

/** Conversión de mm a píxeles CSS (96 dpi). Solo se usa en el editor. */
export const PX_PER_MM = 96 / 25.4;

const mm = (value) => `${round(value)}mm`;
const pt = (value) => `${round(value)}pt`;
function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

export function fontWeights(family) {
  return WEIGHTS_BY_FAMILY[family] || DEFAULT_WEIGHTS;
}

/** URL de Google Fonts para las familias indicadas (normal + itálica). */
export function googleFontsUrl(families = FONTS.map((f) => f.family)) {
  const params = families
    .filter((family) => FONTS.some((f) => f.family === family))
    .map((family) => {
      const weights = fontWeights(family);
      const axes = NO_ITALIC.includes(family)
        ? `wght@${weights.join(';')}`
        : `ital,wght@${[...weights.map((w) => `0,${w}`), ...weights.map((w) => `1,${w}`)].join(';')}`;
      return `family=${family.replace(/ /g, '+')}:${axes}`;
    })
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=block`;
}

export function fontStack(family) {
  const font = FONTS.find((f) => f.family === family) || FONTS.find((f) => f.family === DEFAULT_FONT);
  return `'${font.family}', ${font.category}`;
}

/** HEX, "transparent" o token (primary…) → valor CSS. */
export function resolveColor(value, fallback) {
  const color = value ?? fallback;
  if (color == null) return undefined;
  if (COLOR_TOKENS[color]) return `var(${COLOR_TOKENS[color]})`;
  return color;
}

/** Variables CSS del catálogo (se aplican en la raíz del documento/página). */
export function catalogCssVars(catalog) {
  return {
    '--color-primary': catalog.colorPrimary,
    '--color-secondary': catalog.colorSecondary,
    '--color-text': catalog.colorText,
    '--color-background': catalog.colorBackground,
  };
}

export function pageStyle(page, size) {
  return {
    position: 'relative',
    width: mm(size.width),
    height: mm(size.height),
    overflow: 'hidden',
    backgroundColor: resolveColor(page.backgroundColor, 'background'),
  };
}

/** Posición y tamaño del elemento dentro de la página (el editor lo delega a react-rnd). */
export function elementFrameStyle(el) {
  return {
    position: 'absolute',
    left: mm(el.x),
    top: mm(el.y),
    width: mm(el.width),
    height: mm(el.height),
    zIndex: el.zIndex ?? 0,
  };
}

function borderValue(el) {
  if (!el.borderWidth || el.borderStyle === 'none') return undefined;
  return `${mm(el.borderWidth)} ${el.borderStyle || 'solid'} ${resolveColor(el.borderColor, 'text')}`;
}

function baseContentStyle(el) {
  return {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    transform: el.rotation ? `rotate(${round(el.rotation)}deg)` : undefined,
    opacity: el.opacity ?? undefined,
  };
}

const VERTICAL_ALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

function textStyles(el) {
  return {
    content: {
      ...baseContentStyle(el),
      display: 'flex',
      flexDirection: 'column',
      justifyContent: VERTICAL_ALIGN[el.verticalAlign] || 'flex-start',
      overflow: 'hidden',
      fontFamily: fontStack(el.fontFamily),
      fontSize: pt(el.fontSize ?? 12),
      fontWeight: el.fontWeight ?? 400,
      fontStyle: el.fontStyle || 'normal',
      lineHeight: el.lineHeight ?? 1.25,
      letterSpacing: el.letterSpacing ? pt(el.letterSpacing) : undefined,
      color: resolveColor(el.color, 'text'),
      textAlign: el.textAlign || 'left',
      backgroundColor: resolveColor(el.backgroundColor),
      padding: el.padding ? mm(el.padding) : undefined,
      border: borderValue(el),
      borderRadius: el.borderRadius ? mm(el.borderRadius) : undefined,
    },
    inner: {
      margin: 0,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
    },
  };
}

function imageStyles(el) {
  return {
    content: {
      ...baseContentStyle(el),
      overflow: 'hidden',
      backgroundColor: resolveColor(el.backgroundColor),
      border: borderValue(el),
      borderRadius: el.borderRadius ? mm(el.borderRadius) : undefined,
    },
    inner: {
      display: 'block',
      width: '100%',
      height: '100%',
      objectFit: el.objectFit || 'cover',
    },
  };
}

function lineStyles(el) {
  return {
    content: {
      ...baseContentStyle(el),
      display: 'flex',
      alignItems: 'center',
    },
    inner: {
      width: '100%',
      height: 0,
      borderTop: `${mm(el.borderWidth ?? 0.5)} ${el.borderStyle && el.borderStyle !== 'none' ? el.borderStyle : 'solid'} ${resolveColor(el.color, 'text')}`,
    },
  };
}

function rectangleStyles(el) {
  return {
    content: {
      ...baseContentStyle(el),
      backgroundColor: resolveColor(el.backgroundColor, 'primary'),
      border: borderValue(el),
      borderRadius: el.borderRadius ? mm(el.borderRadius) : undefined,
    },
    inner: null,
  };
}

/** Tipo visual ("kind") de cada tipo de elemento. Nuevos tipos: agregar aquí. */
export const ELEMENT_KINDS = {
  title: 'text',
  subtitle: 'text',
  text: 'text',
  textBlock: 'text',
  image: 'image',
  line: 'line',
  rectangle: 'rectangle',
};

const STYLE_BUILDERS = { text: textStyles, image: imageStyles, line: lineStyles, rectangle: rectangleStyles };

/** Estilos del contenido visual de un elemento: { kind, content, inner }. */
export function elementContentStyles(el) {
  const kind = ELEMENT_KINDS[el.type] || 'rectangle';
  return { kind, ...STYLE_BUILDERS[kind](el) };
}

/** Elimina claves con valor undefined/null (útil para comparar y serializar). */
export function cleanStyle(style) {
  const result = {};
  for (const [key, value] of Object.entries(style || {})) {
    if (value !== undefined && value !== null && value !== '') result[key] = value;
  }
  return result;
}

/** Elementos visibles ordenados por capa (zIndex). */
export function sortElements(elements) {
  return [...(elements || [])].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}
