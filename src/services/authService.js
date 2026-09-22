import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { verifyPassword } from './passwordService.js';
import { signToken } from './tokenService.js';
import { publicUserSelect } from './userService.js';

/**
 * Valida credenciales contra la base de datos.
 * Para no revelar qué correos existen, el mensaje es el mismo si el usuario
 * no existe o si la contraseña es incorrecta.
 */
export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);

  if (!user || !valid) {
    throw AppError.unauthorized('Correo o contraseña incorrectos', 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'ACTIVE') {
    throw AppError.forbidden('Tu cuenta está desactivada', 'USER_INACTIVE');
  }

  return { token: signToken(user), user: await getProfile(user.id) };
}

export function getProfile(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
}
