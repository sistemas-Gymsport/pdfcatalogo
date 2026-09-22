/**
 * Crea (o actualiza) el primer administrador a partir de variables de entorno.
 * No contiene credenciales: se leen de ADMIN_EMAIL y ADMIN_PASSWORD.
 *
 *   ADMIN_EMAIL=admin@empresa.com ADMIN_PASSWORD='...' npm run seed
 *
 * Si el usuario ya existe, NO cambia su contraseña salvo que ADMIN_RESET_PASSWORD=true.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const resetPassword = process.env.ADMIN_RESET_PASSWORD === 'true';

  if (!email || !password) {
    console.error('❌ Define ADMIN_EMAIL y ADMIN_PASSWORD para crear el administrador.');
    process.exitCode = 1;
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('❌ ADMIN_EMAIL no es un correo válido.');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('❌ ADMIN_PASSWORD debe tener al menos 8 caracteres.');
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !resetPassword) {
    console.log(`ℹ️  El administrador ${email} ya existe. No se modificó (usa ADMIN_RESET_PASSWORD=true para cambiar su contraseña).`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, status: 'ACTIVE' },
    create: { email, passwordHash, role: 'ADMIN', status: 'ACTIVE' },
  });
  console.log(existing ? `✅ Contraseña actualizada para ${email}` : `✅ Administrador creado: ${email}`);
}

main()
  .catch((error) => {
    console.error('❌ Error al ejecutar el seed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
