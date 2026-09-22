/**
 * Registro de formatos de página (medidas en mm, orientación vertical).
 * Para agregar un formato nuevo basta con añadir una entrada aquí.
 */
export const PAGE_FORMATS = {
  NORMAL: { label: 'Normal', description: 'Hoja estándar · 210 × 297 mm', width: 210, height: 297 },
  ESTRECHO: { label: 'Estrecho', description: 'Vertical reducido · 148 × 297 mm', width: 148, height: 297 },
  A4: { label: 'A4', description: '210 × 297 mm', width: 210, height: 297 },
  CARTA: { label: 'Carta', description: '215.9 × 279.4 mm', width: 215.9, height: 279.4 },
  OFICIO: { label: 'Oficio', description: '215.9 × 340.4 mm', width: 215.9, height: 340.4 },
  PERSONALIZADO: { label: 'Personalizado', description: 'Medidas libres en mm', width: null, height: null },
};

export const ORIENTATIONS = ['PORTRAIT', 'LANDSCAPE'];

export const CUSTOM_LIMITS = { min: 50, max: 1200 };

/** Devuelve { width, height } en mm aplicando formato y orientación. */
export function getPageSize({ format, orientation, customWidth, customHeight }) {
  const def = PAGE_FORMATS[format] || PAGE_FORMATS.NORMAL;
  let width = def.width ?? customWidth ?? 210;
  let height = def.height ?? customHeight ?? 297;
  if (orientation === 'LANDSCAPE') [width, height] = [height, width];
  return { width, height };
}

export function listFormats() {
  return Object.entries(PAGE_FORMATS).map(([key, value]) => ({ key, ...value }));
}
