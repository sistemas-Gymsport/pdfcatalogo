import { prisma } from '../config/prisma.js';
import { isCloudinaryConfigured, env } from '../config/env.js';
import { listFormats, ORIENTATIONS, CUSTOM_LIMITS } from '../config/pageFormats.js';
import { FONTS, fontWeights, googleFontsUrl } from '../config/fonts.js';
import { ELEMENT_TYPES, COLOR_TOKENS } from '../config/elementTypes.js';
import { sendSuccess } from '../utils/response.js';

/** Estado del servicio (público, usado por Render como health check). */
export async function health(_req, res) {
  let database = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'error';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    success: database === 'ok',
    data: { status: database === 'ok' ? 'ok' : 'degraded', database, timestamp: new Date().toISOString() },
  });
}

/** Configuración del editor: formatos, fuentes, tipos de elemento y estado de servicios. */
export function editorConfig(_req, res) {
  sendSuccess(res, {
    formats: listFormats(),
    orientations: ORIENTATIONS,
    customLimits: CUSTOM_LIMITS,
    fonts: FONTS.map((font) => ({ ...font, weights: fontWeights(font.family) })),
    fontsUrl: googleFontsUrl(),
    elementTypes: ELEMENT_TYPES,
    colorTokens: Object.keys(COLOR_TOKENS),
    maxUploadMb: env.maxUploadMb,
    services: { cloudinary: isCloudinaryConfigured() },
  });
}
