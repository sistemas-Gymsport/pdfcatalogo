import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../services/tokenService.js';
import { prisma } from '../config/prisma.js';

/**
 * Exige un JWT válido en "Authorization: Bearer <token>" y que el usuario
 * siga existiendo y activo en la base de datos.
 */
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw AppError.unauthorized('Debes iniciar sesión para continuar', 'AUTH_REQUIRED');
  }

  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, status: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw AppError.unauthorized('Tu sesión ya no es válida', 'SESSION_INVALID');
  }

  req.user = user;
  next();
}

/** Todos los usuarios actuales son ADMIN; se deja preparado para futuros roles. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) throw AppError.forbidden();
  next();
};
