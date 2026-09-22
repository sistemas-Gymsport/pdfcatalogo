import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/services/passwordService.js';

export const hasDb = Boolean(process.env.HAS_TEST_DB);

export const app = createApp();
export const api = () => request(app);

export const ADMIN = { email: 'admin@test.com', password: 'Password123!' };

/** Vacía las tablas (en orden por dependencias). */
export async function resetDb() {
  await prisma.pageElement.deleteMany();
  await prisma.catalogPage.deleteMany();
  await prisma.catalog.deleteMany();
  await prisma.image.deleteMany();
  await prisma.user.deleteMany();
}

export async function createAdmin(data = ADMIN, status = 'ACTIVE') {
  return prisma.user.create({
    data: { email: data.email, passwordHash: await hashPassword(data.password), role: 'ADMIN', status },
  });
}

/** Crea el admin de pruebas y devuelve un token válido. */
export async function loginAsAdmin() {
  await createAdmin();
  const res = await api().post('/api/auth/login').send(ADMIN);
  return res.body.data.token;
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

export const sampleCatalog = {
  name: 'Catálogo de prueba',
  description: 'Descripción',
  format: 'NORMAL',
  orientation: 'PORTRAIT',
  marginTop: 15,
  marginBottom: 15,
  marginLeft: 15,
  marginRight: 15,
  colorPrimary: '#F64851',
  colorSecondary: '#1F2937',
  colorText: '#111827',
  colorBackground: '#FFFFFF',
};

export async function createCatalog(token, overrides = {}) {
  const res = await api().post('/api/catalogs').set(auth(token)).send({ ...sampleCatalog, ...overrides });
  return res.body.data;
}

export { prisma };
