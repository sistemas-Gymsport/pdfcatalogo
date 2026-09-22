import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];

/**
 * Las imágenes se mantienen en memoria y se envían directamente a Cloudinary.
 * Nunca se escriben en el disco del servidor.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(AppError.badRequest('Formato no permitido. Usa JPG, PNG, WEBP, GIF, AVIF o SVG', 'INVALID_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
}).single('file');
