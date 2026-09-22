import { ZodError } from 'zod';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

function toAppError(err) {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    const details = formatZodIssues(err);
    return AppError.badRequest(details[0]?.message || 'Datos inválidos', 'VALIDATION_ERROR', details);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return AppError.conflict('Ya existe un registro con esos datos', 'DUPLICATE');
    if (err.code === 'P2025') return AppError.notFound();
    if (err.code === 'P2003') return AppError.badRequest('Referencia inválida a otro registro', 'INVALID_REFERENCE');
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return AppError.serviceUnavailable('No se pudo conectar con la base de datos', 'DATABASE_UNAVAILABLE');
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError(`La imagen supera el máximo de ${env.maxUploadMb} MB`, 413, 'FILE_TOO_LARGE');
    }
    return AppError.badRequest('Archivo inválido', 'INVALID_FILE');
  }

  if (err?.type === 'entity.parse.failed') return AppError.badRequest('JSON inválido', 'INVALID_JSON');
  if (err?.type === 'entity.too.large') return new AppError('La solicitud es demasiado grande', 413, 'PAYLOAD_TOO_LARGE');

  return null;
}

/** Manejador final: respuesta uniforme { success:false, message, errorCode } sin filtrar detalles internos. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const appError = toAppError(err);

  if (!appError || appError.statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  const status = appError?.statusCode || 500;
  const body = {
    success: false,
    message: appError?.message || 'Ocurrió un error inesperado. Intenta nuevamente.',
    errorCode: appError?.errorCode || 'INTERNAL_ERROR',
  };
  if (appError?.details) body.details = appError.details;

  res.status(status).json(body);
}

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'));
}
