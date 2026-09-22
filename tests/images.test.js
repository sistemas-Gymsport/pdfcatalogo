import { describe, it, expect, beforeEach, vi } from 'vitest';

// Cloudinary se simula: se verifica la integración (metadatos, publicId, borrado)
// sin depender de credenciales reales.
const uploaded = new Map();
vi.mock('../src/services/cloudinaryService.js', () => ({
  uploadBuffer: vi.fn(async (buffer) => {
    const publicId = `pdfcatalogo/test-${uploaded.size + 1}`;
    uploaded.set(publicId, buffer.length);
    return {
      secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${publicId}.png`,
      public_id: publicId,
      width: 1,
      height: 1,
      format: 'png',
      bytes: buffer.length,
    };
  }),
  destroyAsset: vi.fn(async (publicId) => (uploaded.delete(publicId) ? 'ok' : 'not found')),
}));

const { api, auth, hasDb, loginAsAdmin, resetDb, createCatalog, prisma } = await import('./helpers.js');
const cloudinary = await import('../src/services/cloudinaryService.js');

// PNG de 1×1 px
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe.skipIf(!hasDb)('Imágenes', () => {
  let token;

  beforeEach(async () => {
    await resetDb();
    uploaded.clear();
    vi.clearAllMocks();
    token = await loginAsAdmin();
  });

  const upload = (fields = {}, file = PNG, filename = 'mi-foto_producto.png') => {
    const req = api().post('/api/images').set(auth(token));
    for (const [key, value] of Object.entries(fields)) req.field(key, value);
    return req.attach('file', file, filename);
  };

  it('sube a Cloudinary y guarda metadatos (url, publicId, medidas)', async () => {
    const res = await upload({ name: 'Producto', description: 'Vista frontal' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Producto',
      description: 'Vista frontal',
      width: 1,
      height: 1,
      format: 'png',
      usageCount: 0,
    });
    expect(res.body.data.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(res.body.data.publicId).toMatch(/^pdfcatalogo\//);
    expect(cloudinary.uploadBuffer).toHaveBeenCalledOnce();
  });

  it('usa el nombre del archivo si no se indica nombre', async () => {
    const res = await upload();
    expect(res.body.data.name).toBe('mi foto producto');
  });

  it('rechaza archivos que no son imagen y peticiones sin archivo', async () => {
    const bad = await upload({}, Buffer.from('hola'), 'texto.txt');
    expect(bad.status).toBe(400);
    expect(bad.body.errorCode).toBe('INVALID_FILE_TYPE');

    const none = await api().post('/api/images').set(auth(token)).field('name', 'x');
    expect(none.status).toBe(400);
    expect(none.body.errorCode).toBe('FILE_REQUIRED');
  });

  it('lista, busca y edita información', async () => {
    const a = (await upload({ name: 'Silla roja' })).body.data;
    await upload({ name: 'Mesa', description: 'madera' });

    expect((await api().get('/api/images').set(auth(token))).body.data).toHaveLength(2);
    expect((await api().get('/api/images?search=roja').set(auth(token))).body.data).toHaveLength(1);
    expect((await api().get('/api/images?search=MADERA').set(auth(token))).body.data).toHaveLength(1);

    const edited = await api().patch(`/api/images/${a.id}`).set(auth(token)).send({ name: 'Silla azul', description: '' });
    expect(edited.body.data).toMatchObject({ name: 'Silla azul', description: null });
  });

  it('elimina en Cloudinary (por publicId) y en BD si no está en uso', async () => {
    const image = (await upload()).body.data;
    const res = await api().delete(`/api/images/${image.id}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(cloudinary.destroyAsset).toHaveBeenCalledWith(image.publicId);
    expect(uploaded.has(image.publicId)).toBe(false);
    expect(await prisma.image.findUnique({ where: { id: image.id } })).toBeNull();
  });

  it('NO elimina una imagen usada en un catálogo (409) y no toca Cloudinary', async () => {
    const image = (await upload()).body.data;
    const catalog = await createCatalog(token, { name: 'Catálogo con foto' });
    const pageId = catalog.pages[0].id;
    const el = (await api().post(`/api/pages/${pageId}/elements`).set(auth(token)).send({ type: 'image', x: 0, y: 0, width: 10, height: 10, imageId: image.id })).body.data;

    const res = await api().delete(`/api/images/${image.id}`).set(auth(token));
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('IMAGE_IN_USE');
    expect(res.body.message).toContain('Catálogo con foto');
    expect(res.body.details[0]).toMatchObject({ name: 'Catálogo con foto', pages: [1] });
    expect(cloudinary.destroyAsset).not.toHaveBeenCalled();
    expect((await prisma.pageElement.findUnique({ where: { id: el.id } })).imageId).toBe(image.id);

    // Se puede reutilizar en varios elementos y catálogos; al quitarla, ya se puede borrar.
    const other = await createCatalog(token, { name: 'Otro' });
    await api().post(`/api/pages/${other.pages[0].id}/elements`).set(auth(token)).send({ type: 'image', x: 0, y: 0, width: 10, height: 10, imageId: image.id });
    expect((await api().get(`/api/images/${image.id}`).set(auth(token))).body.data.usageCount).toBe(2);
    await api().delete(`/api/catalogs/${catalog.id}`).set(auth(token));
    await api().delete(`/api/catalogs/${other.id}`).set(auth(token));
    expect((await api().delete(`/api/images/${image.id}`).set(auth(token))).status).toBe(200);
  });

  it('si Cloudinary falla al eliminar, se conserva el registro', async () => {
    const image = (await upload()).body.data;
    const { AppError } = await import('../src/utils/AppError.js');
    cloudinary.destroyAsset.mockRejectedValueOnce(new AppError('fallo', 502, 'CLOUDINARY_ERROR'));
    const res = await api().delete(`/api/images/${image.id}`).set(auth(token));
    expect(res.status).toBe(502);
    expect(await prisma.image.findUnique({ where: { id: image.id } })).not.toBeNull();
  });
});
