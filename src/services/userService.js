import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword, verifyPassword } from './passwordService.js';

/** Campos públicos: nunca se devuelve passwordHash. */
export const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

export function listUsers() {
  return prisma.user.findMany({ select: publicUserSelect, orderBy: { createdAt: 'asc' } });
}

export async function createUser({ email, password }) {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw AppError.conflict('Ya existe un usuario con ese correo', 'EMAIL_IN_USE');
  return prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), role: 'ADMIN', status: 'ACTIVE' },
    select: publicUserSelect,
  });
}

export async function updateUserStatus(currentUserId, userId, status) {
  if (currentUserId === userId && status !== 'ACTIVE') {
    throw AppError.badRequest('No puedes desactivar tu propia cuenta', 'CANNOT_DEACTIVATE_SELF');
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('Usuario no encontrado', 'USER_NOT_FOUND');
  return prisma.user.update({ where: { id: userId }, data: { status }, select: publicUserSelect });
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('Usuario no encontrado', 'USER_NOT_FOUND');
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw AppError.badRequest('La contraseña actual no es correcta', 'INVALID_CURRENT_PASSWORD');
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
}
