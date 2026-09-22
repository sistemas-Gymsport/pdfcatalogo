import { describe, it, expect, beforeEach } from 'vitest';
import { api, auth, hasDb, loginAsAdmin, resetDb, createCatalog } from './helpers.js';

describe.skipIf(!hasDb)('Páginas', () => {
  let token;
  let catalog;

  beforeEach(async () => {
    await resetDb();
    token = await loginAsAdmin();
    catalog = await createCatalog(token);
  });

  const pagesOf = async () => (await api().get(`/api/catalogs/${catalog.id}/pages`).set(auth(token))).body.data;

  it('crea al final y en una posición', async () => {
    const second = await api().post(`/api/catalogs/${catalog.id}/pages`).set(auth(token)).send({ name: 'Segunda' });
    expect(second.status).toBe(201);
    expect(second.body.data.order).toBe(1);

    const first = await api().post(`/api/catalogs/${catalog.id}/pages`).set(auth(token)).send({ name: 'Nueva primera', position: 0 });
    expect(first.body.data.order).toBe(0);

    const pages = await pagesOf();
    expect(pages.map((p) => p.name)).toEqual(['Nueva primera', null, 'Segunda']);
  });

  it('edita nombre y color de fondo', async () => {
    const pageId = catalog.pages[0].id;
    const res = await api().patch(`/api/pages/${pageId}`).set(auth(token)).send({ name: 'Portada', backgroundColor: 'primary' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Portada', backgroundColor: 'primary' });
  });

  it('duplica con sus elementos justo después', async () => {
    const pageId = catalog.pages[0].id;
    await api().post(`/api/pages/${pageId}/elements`).set(auth(token)).send({ type: 'rectangle', x: 0, y: 0, width: 50, height: 50 });
    await api().post(`/api/catalogs/${catalog.id}/pages`).set(auth(token)).send({ name: 'Final' });

    const dup = await api().post(`/api/pages/${pageId}/duplicate`).set(auth(token));
    expect(dup.status).toBe(201);
    expect(dup.body.data.order).toBe(1);
    expect(dup.body.data.elements).toHaveLength(1);

    const pages = await pagesOf();
    expect(pages).toHaveLength(3);
    expect(pages[2].name).toBe('Final');
  });

  it('reordena', async () => {
    const b = (await api().post(`/api/catalogs/${catalog.id}/pages`).set(auth(token)).send({ name: 'B' })).body.data;
    const c = (await api().post(`/api/catalogs/${catalog.id}/pages`).set(auth(token)).send({ name: 'C' })).body.data;
    const a = catalog.pages[0];

    const res = await api().put(`/api/catalogs/${catalog.id}/pages/order`).set(auth(token)).send({ pageIds: [c.id, a.id, b.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.id)).toEqual([c.id, a.id, b.id]);

    const bad = await api().put(`/api/catalogs/${catalog.id}/pages/order`).set(auth(token)).send({ pageIds: [c.id] });
    expect(bad.status).toBe(400);
  });

  it('elimina y renumera; no permite borrar la última', async () => {
    const b = (await api().post(`/api/catalogs/${catalog.id}/pages`).set(auth(token)).send({ name: 'B' })).body.data;
    const del = await api().delete(`/api/pages/${catalog.pages[0].id}`).set(auth(token));
    expect(del.status).toBe(200);

    const pages = await pagesOf();
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ id: b.id, order: 0 });

    const last = await api().delete(`/api/pages/${b.id}`).set(auth(token));
    expect(last.status).toBe(400);
    expect(last.body.errorCode).toBe('LAST_PAGE');
  });

  it('incrementa la versión del catálogo', async () => {
    await api().post(`/api/catalogs/${catalog.id}/pages`).set(auth(token)).send({});
    const got = await api().get(`/api/catalogs/${catalog.id}`).set(auth(token));
    expect(got.body.data.version).toBe(2);
  });
});
