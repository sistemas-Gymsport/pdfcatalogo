import { z } from 'zod';

export const email = z
  .string({ message: 'El correo es obligatorio' })
  .trim()
  .min(1, 'El correo es obligatorio')
  .toLowerCase()
  .pipe(z.email('Correo electrónico inválido'));

export const newPassword = z
  .string({ message: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

export const loginSchema = z.object({
  email,
  password: z.string({ message: 'La contraseña es obligatoria' }).min(1, 'La contraseña es obligatoria').max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword,
});

export const createUserSchema = z.object({
  email,
  password: newPassword,
});

export const updateUserSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
