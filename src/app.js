import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { AppError } from './utils/AppError.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import apiRoutes from './routes/index.js';

/** Construye la aplicación Express (separada de server.js para poder testearla). */
export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render/Vercel están detrás de un proxy
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // CORS: solo los orígenes configurados en CORS_ORIGINS.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(AppError.forbidden('Origen no permitido por CORS', 'CORS_NOT_ALLOWED'));
      },
      exposedHeaders: ['Content-Disposition'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '5mb' }));

  app.get('/', (_req, res) => res.json({ success: true, data: { name: 'pdfcatalogo-api', status: 'ok' } }));
  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
