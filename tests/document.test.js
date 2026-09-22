import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { api, auth, hasDb, loginAsAdmin, resetDb, createCatalog, prisma } from './helpers.js';

const element = (overrides) => ({
  id: randomUUID(),
  type: 'text',
  x: 15,
  y: 20,
  width: 100,
  height: 20,
  rotation: 0,
  zIndex: 1,
  locked: false,
  hidden: false,
  content: 'Texto',
  fontSize: 12,
  fontFamily: 'Inter',
  fontWeight: 400,
  color: 'text',
  textAlign: 'left',
  ...overrides,
});

describe.skipIf(!hasDb)('Guardar documento (editor)', () => {
  let token;
  let catalog;

  beforeEach(async () => {
    await resetDb();
    token = await loginAsAdmin();
    catalog = await createCatalog(token);
  });

  const save = (body) => api().put(`/api/catalogs/${catalog.id}/document`).set(auth(token)).send(body);

  it('guarda páginas y elementos y al recargar el diseño es idéntico', async () => {
    const image = await prisma.image.create({ data: { name: 'Foto', url: 'https://example.com/a.jpg', publicId: 'x/a', width: 10, height: 10 } });
    const page1 = {
      id: catalog.pages[0].id,
      name: 'Portada',
      backgroundColor: 'secondary',
      elements: [
        element({ type: 'title', content: 'Título principal', fontSize: 32, fontWeight: 800, color: 'primary', x: 15.5, y: 12.25 }),
        element({ type: 'image', content: null, imageId: image.id, objectFit: 'cover', x: 0, y: 60, width: 210, height: 120, zIndex: 0, borderRadius: 4 }),
        element({ type: 'line', content: null, color: '#F64851', borderWidth: 0.8, borderStyle: 'dashed', y: 50, height: 4 }),
      ],
    };
    const page2 = { id: randomUUID(), name: null, backgroundColor: null, elements: [element({ type: 'rectangle', content: null, backgroundColor: 'primary', rotation: 12, opacity: 0.5 })] };

    const res = await save({ version: 1, pages: [page1, page2] });
    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(2);

    const reloaded = (await api().get(`/api/catalogs/${catalog.id}`).set(auth(token))).body.data;
    expect(reloaded.pages.map((p) => p.id)).toEqual([page1.id, page2.id]);
    expect(reloaded.pages[0]).toMatchObject({ name: 'Portada', backgroundColor: 'secondary' });

    for (const sent of page1.elements) {
      const stored = reloaded.pages[0].elements.find((e) => e.id === sent.id);
      expect(stored).toMatchObject(sent);
    }
    expect(reloaded.pages[0].elements.find((e) => e.type === 'image').image.url).toBe(image.url);
    expect(reloaded.pages[1].elements[0]).toMatchObject({ rotation: 12, opacity: 0.5 });
  });

  it('elimina páginas y elementos que ya no están en el documento', async () => {
    const extra = { id: randomUUID(), elements: [element()] };
    await save({ version: 1, pages: [{ id: catalog.pages[0].id, elements: [element()] }, extra] });
    const res = await save({ version: 2, pages: [{ id: extra.id, elements: [] }] });
    expect(res.status).toBe(200);
    expect(res.body.data.pages).toHaveLength(1);
    expect(res.body.data.pages[0].elements).toHaveLength(0);
    expect(await prisma.pageElement.count()).toBe(0);
  });

  it('conflicto de versión → 409', async () => {
    await save({ version: 1, pages: [{ id: catalog.pages[0].id, elements: [] }] });
    const stale = await save({ version: 1, pages: [{ id: catalog.pages[0].id, elements: [] }] });
    expect(stale.status).toBe(409);
    expect(stale.body.errorCode).toBe('VERSION_CONFLICT');
  });

  it('desvincula imágenes que ya no existen', async () => {
    const res = await save({
      version: 1,
      pages: [{ id: catalog.pages[0].id, elements: [element({ type: 'image', imageId: randomUUID() })] }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.pages[0].elements[0].imageId).toBeNull();
  });

  it('rechaza ids duplicados y elementos inválidos', async () => {
    const el = element();
    const dup = await save({ version: 1, pages: [{ id: catalog.pages[0].id, elements: [el, el] }] });
    expect(dup.status).toBe(400);
    const invalid = await save({ version: 1, pages: [{ id: catalog.pages[0].id, elements: [element({ width: -5 })] }] });
    expect(invalid.status).toBe(400);
  });
});
