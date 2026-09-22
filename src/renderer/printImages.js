/**
 * URL de imagen para el PDF a resolución de impresión.
 *
 * El recuadro se mide en mm; a 300 ppp se calcula cuántos píxeles necesita.
 * Para imágenes de Cloudinary se pide esa medida exacta (sin agrandar las
 * pequeñas), así el PDF mantiene calidad de imprenta sin cargar originales de
 * miles de píxeles en Chromium (clave en servidores con 512 MB de RAM).
 *   cover   → c_lfill (mismo recorte centrado que object-fit: cover)
 *   contain → c_limit (cabe completa, como object-fit: contain)
 *   fill    → c_limit (el estirado lo hace CSS)
 */
export const PRINT_DPI = 300;
const MAX_PX = 4000;

const mmToPx = (mm) => Math.min(MAX_PX, Math.max(1, Math.ceil((mm / 25.4) * PRINT_DPI)));

export function printImageUrl(url, element) {
  if (!url || !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  const width = mmToPx(element.width);
  const height = mmToPx(element.height);
  const crop = (element.objectFit || 'cover') === 'cover' ? 'c_lfill' : 'c_limit';
  return url.replace('/image/upload/', `/image/upload/${crop},w_${width},h_${height},q_auto:best/`);
}
