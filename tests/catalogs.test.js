import { describe, it, expect, beforeEach } from 'vitest';
import { api, auth, hasDb, loginAsAdmin, resetDb, sampleCatalog, createCatalog, prisma } from './helpers.js';

describe.skipIf(!hasDb)('Catálogos', () => {
  let token;

  beforeEach(async () => {
    await resetDb();
    token = await loginAsAdmin();
  });

  it('crea un catálogo con una primera página y dimensiones calculadas', async () => {
    const res = await api().post('/api/catalogs').set(auth(token)).send(sampleCatalog);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: sampleCatalog.name, pageWidth: 210, pageHeight: 297, version: 1 });
    expect(res.body.data.pages).toHaveLength(1);
  });

  it('formato ESTRECHO y orientación horizontal', async () => {
    const narrow = await createCatalog(token, { format: 'ESTRECHO' });
    expect([narrow.pageWidth, narrow.pageHeight]).toEqual([148, 297]);
    const landscape = await createCatalog(token, { orientation: 'LANDSCAPE' });
    expect([landscape.pageWidth, landscape.pageHeight]).toEqual([297, 210]);
  });

  it('formato personalizado exige medidas', async () => {
    const bad = await api().post('/api/catalogs').set(auth(token)).send({ ...sampleCatalog, format: 'PERSONALIZADO' });
    expect(bad.status).toBe(400);
    const ok = await createCatalog(token, { format: 'PERSONALIZADO', customWidth: 100, customHeight: 200 });
    expect([ok.pageWidth, ok.pageHeight]).toEqual([100, 200]);
  });

  it('normaliza colores HEX y rechaza inválidos', async () => {
    const ok = await createCatalog(token, { colorPrimary: '#f64' });
    expect(ok.colorPrimary).toBe('#FF6644');
    const bad = await api().post('/api/catalogs').set(auth(token)).send({ ...sampleCatalog, colorPrimary: 'rojo' });
    expect(bad.status).toBe(400);
  });

  it('valida márgenes (negativos y área útil insuficiente)', async () => {
    const negative = await api().post('/api/catalogs').set(auth(token)).send({ ...sampleCatalog, marginTop: -1 });
    expect(negative.status).toBe(400);
    const tooBig = await api().post('/api/catalogs').set(auth(token)).send({ ...sampleCatalog, marginLeft: 100, marginRight: 100 });
    expect(tooBig.status).toBe(400);
  });

  it('nombre obligatorio', async () => {
    const res = await api().post('/api/catalogs').set(auth(token)).send({ ...sampleCatalog, name: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nombre/i);
  });

  it('consulta, lista (con búsqueda) y edita', async () => {
    const catalog = await createCatalog(token);
    await createCatalog(token, { name: 'Otro distinto' });

    const list = await api().get('/api/catalogs').set(auth(token));
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[0].pageCount).toBe(1);
    expect(list.body.data[0].coverPage).toBeTruthy();

    const search = await api().get('/api/catalogs?search=distinto').set(auth(token));
    expect(search.body.data).toHaveLength(1);

    const got = await api().get(`/api/catalogs/${catalog.id}`).set(auth(token));
    expect(got.body.data.id).toBe(catalog.id);

    const updated = await api()
      .put(`/api/catalogs/${catalog.id}`)
      .set(auth(token))
      .send({ ...sampleCatalog, name: 'Editado', marginTop: 20, colorPrimary: '#00AA00' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'Editado', marginTop: 20, colorPrimary: '#00AA00' });
  });

  it('duplica con páginas y elementos', async () => {
    const catalog = await createCatalog(token);
    const pageId = catalog.pages[0].id;
    await api().post(`/api/pages/${pageId}/elements`).set(auth(token)).send({ type: 'title', x: 10, y: 10, width: 100, height: 20, content: 'Hola' });

    const res = await api().post(`/api/catalogs/${catalog.id}/duplicate`).set(auth(token));
    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe(catalog.id);
    expect(res.body.data.name).toContain('(copia)');
    expect(res.body.data.pages[0].id).not.toBe(pageId);
    expect(res.body.data.pages[0].elements[0]).toMatchObject({ type: 'title', content: 'Hola', x: 10 });
  });

  it('eliminar un catálogo borra sus páginas y elementos (sin huérfanos) y conserva las imágenes', async () => {
    const catalog = await createCatalog(token);
    const keep = await createCatalog(token, { name: 'Se conserva' });
    const image = await prisma.image.create({ data: { name: 'F', url: 'https://example.com/f.jpg', publicId: 'x/f', width: 1, height: 1 } });
    await api().post(`/api/catalogs/${catalog.id}/pages`).set(auth(token)).send({});
    await api().post(`/api/pages/${catalog.pages[0].id}/elements`).set(auth(token)).send({ type: 'image', x: 0, y: 0, width: 5, height: 5, imageId: image.id });
    await api().post(`/api/pages/${keep.pages[0].id}/elements`).set(auth(token)).send({ type: 'text', x: 0, y: 0, width: 5, height: 5 });

    await api().delete(`/api/catalogs/${catalog.id}`).set(auth(token));
    expect(await prisma.catalogPage.count({ where: { catalogId: catalog.id } })).toBe(0);
    expect(await prisma.catalogPage.count()).toBe(1);
    expect(await prisma.pageElement.count()).toBe(1);
    expect(await prisma.image.count()).toBe(1);
  });

  it('elimina (y 404 después)', async () => {
    const catalog = await createCatalog(token);
    const del = await api().delete(`/api/catalogs/${catalog.id}`).set(auth(token));
    expect(del.status).toBe(200);
    const got = await api().get(`/api/catalogs/${catalog.id}`).set(auth(token));
    expect(got.status).toBe(404);
    expect(got.body.errorCode).toBe('CATALOG_NOT_FOUND');
  });

  it('id inválido → 400', async () => {
    const res = await api().get('/api/catalogs/no-es-uuid').set(auth(token));
    expect(res.status).toBe(400);
  });

  it('config del editor y estadísticas', async () => {
    const config = await api().get('/api/config').set(auth(token));
    expect(config.body.data.formats.map((f) => f.key)).toContain('ESTRECHO');
    expect(config.body.data.fonts.length).toBeGreaterThan(3);
    const stats = await api().get('/api/stats').set(auth(token));
    expect(stats.body.data).toHaveProperty('catalogs');
  });
});
