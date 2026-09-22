/**
 * Configuración centralizada a partir de variables de entorno.
 * Ningún otro módulo debe leer process.env directamente.
 */
const required = ['DATABASE_URL', 'JWT_SECRET'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
}

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
}

const parseList = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigins: parseList(process.env.CORS_ORIGINS),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'pdfcatalogo',
  },
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 15,
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  // Instancias gratuitas tienen CPU limitada: margen amplio para catálogos largos.
  pdfTimeoutMs: Number(process.env.PDF_TIMEOUT_MS) || 120000,
  pdfMaxConcurrent: Math.max(1, Number(process.env.PDF_MAX_CONCURRENT) || 1),
  pdfPagesPerBatch: Math.max(1, Number(process.env.PDF_PAGES_PER_BATCH) || 4),
};

export const isCloudinaryConfigured = () =>
  Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
