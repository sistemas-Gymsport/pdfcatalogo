import { describe, it, expect, beforeEach } from 'vitest';
import { api, auth, hasDb, loginAsAdmin, resetDb, createCatalog, prisma } from './helpers.js';

describe.skipIf(!hasDb)('Elementos', () => {
  let token;
  let pageId;

  beforeEach(async () => {
    await resetDb();
    token = await loginAsAdmin();
    pageId = (await createCatalog(token)).pages[0].id;
  });

  const create = (data) => api().post(`/api/pages/${pageId}/elements`).set(auth(token)).send(data);

  it('crea todos los tipos', async () => {
    const types = ['title', 'subtitle', 'text', 'textBlock', 'image', 'line', 'rectangle'];
    for (const type of types) {
      const res = await create({ type, x: 10, y: 10, width: 50, height: 20, content: type === 'image' ? null : 'x' });
      expect(res.status, type).toBe(201);
      expect(res.body.data).toMatchObject({ type, x: 10, rotation: 0, locked: false });
    }
  });

  it('rechaza tipos y valores inválidos', async () => {
    expect((await create({ type: 'video', x: 0, y: 0, width: 10, height: 10 })).status).toBe(400);
    expect((await create({ type: 'text', x: 0, y: 0, width: 0, height: 10 })).status).toBe(400);
    expect((await create({ type: 'text', x: 0, y: 0, width: 10, height: 10, color: 'rojo' })).status).toBe(400);
    expect((await create({ type: 'text', x: 0, y: 0, width: 10, height: 10, fontFamily: 'Comic Sans' })).status).toBe(400);
  });

  it('modifica contenido y estilos (solo los campos enviados)', async () => {
    const { body } = await create({ type: 'text', x: 10, y: 10, width: 80, height: 20, content: 'Antes', fontSize: 12, color: '#000000' });
    const res = await api()
      .patch(`/api/elements/${body.data.id}`)
      .set(auth(token))
      .send({ content: 'Después', fontWeight: 700, color: 'primary', textAlign: 'center' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ content: 'Después', fontWeight: 700, color: 'primary', textAlign: 'center', fontSize: 12, x: 10 });
  });

  it('mueve y redimensiona', async () => {
    const { body } = await create({ type: 'rectangle', x: 10, y: 10, width: 50, height: 50 });
    const moved = await api().patch(`/api/elements/${body.data.id}`).set(auth(token)).send({ x: 42.5, y: 100.25 });
    expect(moved.body.data).toMatchObject({ x: 42.5, y: 100.25, width: 50 });
    const resized = await api().patch(`/api/elements/${body.data.id}`).set(auth(token)).send({ width: 120, height: 33.3, rotation: 15 });
    expect(resized.body.data).toMatchObject({ width: 120, height: 33.3, rotation: 15, x: 42.5 });
  });

  it('vincula imagen existente y rechaza imagen inexistente', async () => {
    const image = await prisma.image.create({ data: { name: 'Foto', url: 'https://example.com/a.jpg', publicId: 'x/a', width: 100, height: 80 } });
    const ok = await create({ type: 'image', x: 0, y: 0, width: 50, height: 40, imageId: image.id, objectFit: 'contain' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.image).toMatchObject({ id: image.id, url: image.url });

    const bad = await create({ type: 'image', x: 0, y: 0, width: 50, height: 40, imageId: '00000000-0000-4000-8000-000000000000' });
    expect(bad.status).toBe(400);
  });

  it('elimina', async () => {
    const { body } = await create({ type: 'line', x: 0, y: 0, width: 100, height: 4 });
    expect((await api().delete(`/api/elements/${body.data.id}`).set(auth(token))).status).toBe(200);
    expect((await api().get(`/api/elements/${body.data.id}`).set(auth(token))).status).toBe(404);
  });
});
