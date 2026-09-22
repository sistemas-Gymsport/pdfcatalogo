import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { api, auth, hasDb, loginAsAdmin, resetDb, createCatalog, prisma } from './helpers.js';
import { closeBrowser } from '../src/services/pdfService.js';

// Imagen PNG 2×2 servida localmente (simula la URL de Cloudinary).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64',
);

const MM_TO_PT = 72 / 25.4;

/** Lee número de páginas y tamaños (MediaBox, en pt) del PDF. */
function inspectPdf(buffer) {
  const text = buffer.toString('latin1');
  const pages = text.match(/\/Type\s*\/Page(?!s)/g) || [];
  const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => ({
    width: Number(m[3]) - Number(m[1]),
    height: Number(m[4]) - Number(m[2]),
  }));
  return { pageCount: pages.length, boxes, text };
}

const pdfElement = (overrides) => ({
  id: randomUUID(),
  type: 'text',
  x: 15,
  y: 15,
  width: 120,
  height: 20,
  zIndex: 1,
  content: 'Texto',
  fontFamily: 'Montserrat',
  fontSize: 14,
  ...overrides,
});

describe.skipIf(!hasDb)('Generación de PDF', () => {
  let token;
  let server;
  let imageUrl;

  beforeAll(async () => {
    server = http.createServer((_req, res) => res.writeHead(200, { 'Content-Type': 'image/png' }).end(PNG));
    await new Promise((resolve) => server.listen(0, resolve));
    imageUrl = `http://127.0.0.1:${server.address().port}/foto.png`;
  });

  afterAll(async () => {
    await closeBrowser();
    server.close();
  });

  beforeEach(async () => {
    await resetDb();
    token = await loginAsAdmin();
  });

  async function buildCatalog(settings, pageCount = 3) {
    const catalog = await createCatalog(token, settings);
    const image = await prisma.image.create({ data: { name: 'Foto', url: imageUrl, publicId: `test/${randomUUID()}`, width: 2, height: 2 } });
    const pages = Array.from({ length: pageCount }, (_, i) => ({
      id: i === 0 ? catalog.pages[0].id : randomUUID(),
      backgroundColor: i === 0 ? 'primary' : null,
      elements: [
        pdfElement({ type: 'title', content: `Página ${i + 1}`, fontSize: 28, fontWeight: 700 }),
        pdfElement({ type: 'image', content: null, imageId: image.id, y: 50, width: 100, height: 80 }),
        pdfElement({ type: 'rectangle', content: null, backgroundColor: 'secondary', y: 140, height: 10 }),
      ],
    }));
    await api().put(`/api/catalogs/${catalog.id}/document`).set(auth(token)).send({ version: 1, pages });
    return catalog;
  }

  const download = (id, query = '') =>
    api()
      .get(`/api/pdf/catalogs/${id}${query}`)
      .set(auth(token))
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

  it('genera un PDF con varias páginas, tamaño NORMAL, imágenes y fuentes embebidas', async () => {
    const catalog = await buildCatalog({ name: 'Catálogo Ñandú 2026' });
    const res = await download(catalog.id);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="catalogo-nandu-2026.pdf"');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');

    const { pageCount, boxes, text } = inspectPdf(res.body);
    expect(pageCount).toBe(3);
    for (const box of boxes) {
      expect(box.width).toBeCloseTo(210 * MM_TO_PT, 0);
      expect(box.height).toBeCloseTo(297 * MM_TO_PT, 0);
    }
    expect(text).toMatch(/\/Subtype\s*\/Image/); // imagen embebida
    expect(text).toMatch(/\/FontName\s*\/[A-Z]{6}\+Montserrat/); // tipografía de Google embebida
  }, 90000);

  it('catálogos largos se generan por lotes y se unen en un solo PDF (orden y tamaño correctos)', async () => {
    const catalog = await buildCatalog({ name: 'Largo' }, 14); // 14 páginas → 3 lotes de 6
    const res = await download(catalog.id);
    expect(res.status).toBe(200);
    const { pageCount, boxes } = inspectPdf(res.body);
    expect(pageCount).toBe(14);
    expect(boxes).toHaveLength(14);
    for (const box of boxes) expect(box.width).toBeCloseTo(210 * MM_TO_PT, 0);
  }, 120000);

  it('respeta formato ESTRECHO y orientación horizontal', async () => {
    const narrow = await buildCatalog({ format: 'ESTRECHO' }, 1);
    const narrowPdf = inspectPdf((await download(narrow.id)).body);
    expect(narrowPdf.boxes[0].width).toBeCloseTo(148 * MM_TO_PT, 0);
    expect(narrowPdf.boxes[0].height).toBeCloseTo(297 * MM_TO_PT, 0);

    const landscape = await buildCatalog({ orientation: 'LANDSCAPE' }, 2);
    const landscapePdf = inspectPdf((await download(landscape.id, '?disposition=inline')).body);
    expect(landscapePdf.pageCount).toBe(2);
    expect(landscapePdf.boxes[0].width).toBeCloseTo(297 * MM_TO_PT, 0);
    expect(landscapePdf.boxes[0].height).toBeCloseTo(210 * MM_TO_PT, 0);
  }, 90000);

  it('la vista previa devuelve el mismo HTML del PDF con guías de márgenes', async () => {
    const catalog = await buildCatalog({ marginTop: 20, marginLeft: 12 }, 1);
    const res = await api().get(`/api/pdf/catalogs/${catalog.id}/html?guides=1`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('@page{size:210mm 297mm;margin:0}');
    expect(res.text).toContain('left:12mm;top:20mm');
    expect(res.text).toContain('Página 1');
  });

  it('PDF de catálogo inexistente → 404; sin sesión → 401', async () => {
    expect((await api().get(`/api/pdf/catalogs/${randomUUID()}`).set(auth(token))).status).toBe(404);
    expect((await api().get(`/api/pdf/catalogs/${randomUUID()}`)).status).toBe(401);
  });
});
