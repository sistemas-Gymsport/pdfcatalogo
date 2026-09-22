/** Error de aplicación con estado HTTP y código legible por el frontend. */
export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }

  static badRequest(message, errorCode = 'BAD_REQUEST', details) {
    return new AppError(message, 400, errorCode, details);
  }

  static unauthorized(message = 'No autenticado', errorCode = 'UNAUTHORIZED') {
    return new AppError(message, 401, errorCode);
  }

  static forbidden(message = 'No tienes permiso para esta acción', errorCode = 'FORBIDDEN') {
    return new AppError(message, 403, errorCode);
  }

  static notFound(message = 'Recurso no encontrado', errorCode = 'NOT_FOUND') {
    return new AppError(message, 404, errorCode);
  }

  static conflict(message, errorCode = 'CONFLICT') {
    return new AppError(message, 409, errorCode);
  }

  static serviceUnavailable(message, errorCode = 'SERVICE_UNAVAILABLE') {
    return new AppError(message, 503, errorCode);
  }
}
