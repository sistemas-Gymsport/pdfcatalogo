import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { api, auth, ADMIN, createAdmin, hasDb, resetDb, prisma } from './helpers.js';

describe.skipIf(!hasDb)('Autenticación', () => {
  beforeEach(async () => {
    await resetDb();
    await createAdmin();
  });

  it('login correcto devuelve token y usuario sin passwordHash', async () => {
    const res = await api().post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTypeOf('string');
    expect(res.body.data.user.email).toBe(ADMIN.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('el correo no distingue mayúsculas ni espacios', async () => {
    const res = await api().post('/api/auth/login').send({ email: '  ADMIN@Test.com ', password: ADMIN.password });
    expect(res.status).toBe(200);
  });

  it('contraseña incorrecta → 401 INVALID_CREDENTIALS', async () => {
    const res = await api().post('/api/auth/login').send({ email: ADMIN.email, password: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, errorCode: 'INVALID_CREDENTIALS' });
  });

  it('usuario inexistente → mismo mensaje genérico', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'nadie@test.com', password: 'loquesea' });
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('campos vacíos → 400 VALIDATION_ERROR', async () => {
    const res = await api().post('/api/auth/login').send({ email: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBeTruthy();
  });

  it('usuario desactivado no puede iniciar sesión', async () => {
    await createAdmin({ email: 'off@test.com', password: 'Password123!' }, 'INACTIVE');
    const res = await api().post('/api/auth/login').send({ email: 'off@test.com', password: 'Password123!' });
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('USER_INACTIVE');
  });

  it('la contraseña se guarda con hash bcrypt', async () => {
    const user = await prisma.user.findUnique({ where: { email: ADMIN.email } });
    expect(user.passwordHash).not.toBe(ADMIN.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('ruta protegida sin token → 401', async () => {
    const res = await api().get('/api/catalogs');
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('AUTH_REQUIRED');
  });

  it('token inválido o expirado → 401', async () => {
    const invalid = await api().get('/api/auth/me').set(auth('abc.def.ghi'));
    expect(invalid.status).toBe(401);
    expect(invalid.body.errorCode).toBe('TOKEN_INVALID');

    const user = await prisma.user.findUnique({ where: { email: ADMIN.email } });
    const expired = jwt.sign({ sub: user.id, role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await api().get('/api/auth/me').set(auth(expired));
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('TOKEN_EXPIRED');
  });

  it('/me devuelve el perfil con token válido; logout responde OK', async () => {
    const { body } = await api().post('/api/auth/login').send(ADMIN);
    const me = await api().get('/api/auth/me').set(auth(body.data.token));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(ADMIN.email);

    const logout = await api().post('/api/auth/logout').set(auth(body.data.token));
    expect(logout.status).toBe(200);
  });

  it('un usuario desactivado pierde el acceso aunque tenga token', async () => {
    const { body } = await api().post('/api/auth/login').send(ADMIN);
    await prisma.user.update({ where: { email: ADMIN.email }, data: { status: 'INACTIVE' } });
    const res = await api().get('/api/auth/me').set(auth(body.data.token));
    expect(res.status).toBe(401);
  });

  it('cambio de contraseña', async () => {
    const { body } = await api().post('/api/auth/login').send(ADMIN);
    const token = body.data.token;
    const wrong = await api().put('/api/auth/password').set(auth(token)).send({ currentPassword: 'x', newPassword: 'NuevaClave123' });
    expect(wrong.status).toBe(400);
    const ok = await api().put('/api/auth/password').set(auth(token)).send({ currentPassword: ADMIN.password, newPassword: 'NuevaClave123' });
    expect(ok.status).toBe(200);
    const relogin = await api().post('/api/auth/login').send({ email: ADMIN.email, password: 'NuevaClave123' });
    expect(relogin.status).toBe(200);
  });

  it('gestión de administradores', async () => {
    const { body } = await api().post('/api/auth/login').send(ADMIN);
    const token = body.data.token;
    const created = await api().post('/api/users').set(auth(token)).send({ email: 'otro@test.com', password: 'Password123!' });
    expect(created.status).toBe(201);
    expect(created.body.data.role).toBe('ADMIN');

    const dup = await api().post('/api/users').set(auth(token)).send({ email: 'otro@test.com', password: 'Password123!' });
    expect(dup.status).toBe(409);

    const me = await prisma.user.findUnique({ where: { email: ADMIN.email } });
    const self = await api().patch(`/api/users/${me.id}`).set(auth(token)).send({ status: 'INACTIVE' });
    expect(self.status).toBe(400);

    const list = await api().get('/api/users').set(auth(token));
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[0].passwordHash).toBeUndefined();
  });
});

describe('Errores y CORS', () => {
  it('ruta inexistente → 404 con formato uniforme', async () => {
    const res = await api().get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, errorCode: 'ROUTE_NOT_FOUND' });
  });

  it('JSON mal formado → 400 sin stack trace', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('INVALID_JSON');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });

  it('CORS solo acepta los orígenes configurados', async () => {
    const allowed = await api().get('/').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const blocked = await api().get('/').set('Origin', 'https://malicioso.com');
    expect(blocked.status).toBe(403);
    expect(blocked.body.errorCode).toBe('CORS_NOT_ALLOWED');
  });
});
