/**
 * Verificación de extremo a extremo contra la base de datos y Cloudinary REALES.
 *
 *   npm run verify                                  # API local (http://localhost:PORT)
 *   npm run verify -- https://tu-api.onrender.com   # API desplegada
 *
 * Requisitos: la API en ejecución, migraciones aplicadas y un administrador
 * creado (ADMIN_EMAIL / ADMIN_PASSWORD en backend/.env o en el entorno).
 *
 * Es NO destructivo: no hace reset/drop. Crea un catálogo y una imagen de
 * prueba marcados con "[verificación]" y elimina SOLO esos registros al final.
 * No imprime secretos.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const API = (process.argv[2] || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '') + '/api';
const TAG = `[verificación] ${new Date().toISOString()}`;
const results = [];
let failures = 0;

const ok = (msg) => results.push(`✔ ${msg}`) && console.log(`✔ ${msg}`);
const skip = (msg) => results.push(`– ${msg}`) && console.log(`– OMITIDO: ${msg}`);
function fail(msg) {
  failures += 1;
  console.log(`✘ ${msg}`);
}
function check(condition, msg, detail = '') {
  if (condition) ok(msg);
  else fail(`${msg}${detail ? ` → ${detail}` : ''}`);
  return condition;
}

/** Host sin credenciales, para mostrar a qué se conecta. */
function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return '(URL inválida)';
  }
}

/** PNG en memoria (degradado 400×300), sin escribir archivos. */
function makePng(width = 400, height = 300) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      raw[row + 1 + x * 3] = 246;
      raw[row + 2 + x * 3] = Math.round((x / width) * 200);
      raw[row + 3 + x * 3] = Math.round((y / height) * 200);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function call(method, route, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + route, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers };
}

async function checkDatabase() {
  console.log('\n— Base de datos —');
  if (!process.env.DATABASE_URL) return fail('DATABASE_URL no está definido');
  console.log(`  Conectando a ${safeHost(process.env.DATABASE_URL)}`);
  const prisma = new PrismaClient();
  try {
    const [{ version }] = await prisma.$queryRaw`SELECT version()`;
    ok(`Prisma conecta (${String(version).split(',')[0]})`);

    const folder = path.resolve(import.meta.dirname, '../prisma/migrations');
    const expected = fs.readdirSync(folder).filter((f) => fs.statSync(path.join(folder, f)).isDirectory());
    const applied = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    const names = new Set(applied.map((m) => m.migration_name));
    const pending = expected.filter((m) => !names.has(m));
    check(pending.length === 0, `Migraciones aplicadas (${expected.length})`, `pendientes: ${pending.join(', ')} → ejecuta npm run prisma:deploy`);

    const admins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    check(admins > 0, `Hay ${admins} administrador(es) activo(s)`, 'ejecuta npm run seed');
  } catch (error) {
    fail(`No se pudo consultar la base de datos: ${error.message.split('\n').pop()}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkApi() {
  console.log(`\n— API (${API}) —`);
  const created = { catalogId: null, imageId: null };
  let token;

  try {
    const health = await call('GET', '/health').catch((e) => ({ status: 0, data: { error: e.message } }));
    if (!check(health.status === 200 && health.data?.data?.database === 'ok', 'API en línea y conectada a la base', JSON.stringify(health.data))) return;

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return fail('Define ADMIN_EMAIL y ADMIN_PASSWORD para probar el login');

    const bad = await call('POST', '/auth/login', { body: { email, password: `${password}-incorrecta` } });
    check(bad.status === 401, 'Login con contraseña incorrecta es rechazado');
    const login = await call('POST', '/auth/login', { body: { email, password } });
    if (!check(login.status === 200, 'Login correcto', login.data?.message)) return;
    token = login.data.data.token;
    check((await call('GET', '/catalogs')).status === 401, 'Rutas protegidas sin token → 401');

    const config = (await call('GET', '/config', { token })).data.data;
    const cloudinaryReady = config.services.cloudinary;

    // Catálogo
    const catalogRes = await call('POST', '/catalogs', {
      token,
      body: { name: TAG, format: 'ESTRECHO', orientation: 'PORTRAIT', marginTop: 12, marginBottom: 12, marginLeft: 10, marginRight: 10, colorPrimary: '#F64851' },
    });
    if (!check(catalogRes.status === 201, 'Crear catálogo', catalogRes.data?.message)) return;
    const catalog = catalogRes.data.data;
    created.catalogId = catalog.id;
    check(catalog.pageWidth === 148 && catalog.pageHeight === 297, 'Formato y dimensiones en mm (148 × 297)');

    // Página y elementos (API granular)
    const page2 = await call('POST', `/catalogs/${catalog.id}/pages`, { token, body: { name: 'Página 2' } });
    check(page2.status === 201, 'Crear página');
    const element = await call('POST', `/pages/${page2.data.data.id}/elements`, {
      token,
      body: { type: 'title', x: 10, y: 12, width: 120, height: 14, content: 'Título de prueba', fontSize: 24, color: 'primary' },
    });
    check(element.status === 201, 'Crear elemento');
    const moved = await call('PATCH', `/elements/${element.data.data.id}`, { token, body: { x: 20.5, width: 100 } });
    check(moved.data.data?.x === 20.5 && moved.data.data?.width === 100, 'Mover / redimensionar elemento');

    // Imagen en Cloudinary
    let image = null;
    if (cloudinaryReady) {
      const form = new FormData();
      form.append('file', new Blob([makePng()], { type: 'image/png' }), 'verificacion.png');
      form.append('name', TAG);
      form.append('description', 'Imagen temporal de verificación');
      const up = await call('POST', '/images', { token, form });
      if (check(up.status === 201, 'Subir imagen a Cloudinary', up.data?.message)) {
        image = up.data.data;
        created.imageId = image.id;
        check(/^https:\/\/res\.cloudinary\.com\//.test(image.url), 'URL segura de Cloudinary guardada');
        check(Boolean(image.publicId), `publicId guardado (${image.publicId})`);
        check(image.width === 400 && image.height === 300 && image.format === 'png', 'Metadatos (400×300 png)');
        const cdn = await fetch(image.url);
        check(cdn.ok, 'La imagen es accesible públicamente en la CDN');
        const edited = await call('PATCH', `/images/${image.id}`, { token, body: { name: `${TAG} editada`, description: 'editada' } });
        check(edited.data.data?.description === 'editada', 'Editar información de la imagen');
      }
    } else {
      skip('Cloudinary no está configurado en la API: se omiten las pruebas de imágenes');
    }

    // Documento completo (lo que envía el editor al guardar)
    const current = (await call('GET', `/catalogs/${catalog.id}`, { token })).data.data;
    const doc = {
      version: current.version,
      pages: current.pages.map((p, i) => ({
        id: p.id,
        name: p.name,
        backgroundColor: i === 0 ? 'secondary' : null,
        elements: [
          ...p.elements.map(({ image: _img, pageId, ...e }) => e),
          { id: randomUUID(), type: 'text', x: 10, y: 40, width: 120, height: 30, zIndex: 5, content: `Texto ${i + 1}`, fontFamily: 'Montserrat', fontSize: 11 },
          ...(image
            ? [{ id: randomUUID(), type: 'image', x: 10, y: 80, width: 128, height: 96, zIndex: 1, imageId: image.id, objectFit: 'cover' }]
            : []),
        ],
      })),
    };
    const saved = await call('PUT', `/catalogs/${catalog.id}/document`, { token, body: doc });
    check(saved.status === 200 && saved.data.data.version === current.version + 1, 'Guardar documento (transacción + versión)', saved.data?.message);

    // Reabrir: debe coincidir exactamente con lo guardado
    const reopened = (await call('GET', `/catalogs/${catalog.id}`, { token })).data.data;
    const shape = (pages) => JSON.stringify(pages.map((p) => [p.id, p.backgroundColor, p.elements.map((e) => [e.id, e.type, e.x, e.y, e.width, e.height, e.content, e.imageId]).sort()]));
    check(shape(reopened.pages) === shape(doc.pages.map((p) => ({ ...p, elements: p.elements.map((e) => ({ content: null, imageId: null, ...e })) }))), 'Reabrir: el diseño es idéntico al guardado');

    if (image) {
      const reused = (await call('GET', `/images/${image.id}`, { token })).data.data;
      check(reused.usageCount === 2, 'Imagen reutilizada en 2 páginas del catálogo');
      const blocked = await call('DELETE', `/images/${image.id}`, { token });
      check(blocked.status === 409, 'No permite borrar una imagen en uso');
    }

    // PDF
    const pdf = await call('GET', `/pdf/catalogs/${catalog.id}`, { token });
    const isPdf = Buffer.isBuffer(pdf.data) && pdf.data.subarray(0, 5).toString() === '%PDF-';
    const pages = isPdf ? (pdf.data.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length : 0;
    check(isPdf && pages === 2, `Generar PDF (${pages} páginas, ${isPdf ? Math.round(pdf.data.length / 1024) : 0} KB)`, isPdf ? '' : JSON.stringify(pdf.data));
  } catch (error) {
    fail(`Error inesperado: ${error.message}`);
  } finally {
    // Limpieza: SOLO lo creado por este script.
    if (token && created.catalogId) {
      const del = await call('DELETE', `/catalogs/${created.catalogId}`, { token });
      check(del.status === 200, 'Limpieza: catálogo de prueba eliminado (con sus páginas y elementos)');
    }
    if (token && created.imageId) {
      const del = await call('DELETE', `/images/${created.imageId}`, { token });
      check(del.status === 200, 'Limpieza: imagen de prueba eliminada de la BD y de Cloudinary');
    }
  }
}

await checkDatabase();
await checkApi();
console.log(failures ? `\n❌ ${failures} comprobación(es) fallaron.` : '\n✅ Todas las comprobaciones pasaron.');
process.exitCode = failures ? 1 : 0;
