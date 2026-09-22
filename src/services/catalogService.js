import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { pagesInclude, serializeCatalog } from './catalogSerializer.js';

const ELEMENT_COPY_OMIT = ['id', 'pageId', 'createdAt', 'updatedAt', 'image'];

export async function listCatalogs({ search = '' } = {}) {
  const catalogs = await prisma.catalog.findMany({
    where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { pages: true } },
      // Primera página completa para la miniatura de la tarjeta.
      pages: { ...pagesInclude, take: 1 },
    },
  });
  return catalogs.map(({ _count, ...catalog }) => {
    const { pages, ...serialized } = serializeCatalog(catalog);
    return { ...serialized, pageCount: _count.pages, coverPage: pages[0] || null };
  });
}

/** Catálogo completo: configuración + páginas + elementos + imágenes. */
export async function getCatalog(id) {
  const catalog = await prisma.catalog.findUnique({ where: { id }, include: { pages: pagesInclude } });
  if (!catalog) throw AppError.notFound('Catálogo no encontrado', 'CATALOG_NOT_FOUND');
  return serializeCatalog(catalog);
}

export async function assertCatalogExists(id) {
  const catalog = await prisma.catalog.findUnique({ where: { id }, select: { id: true } });
  if (!catalog) throw AppError.notFound('Catálogo no encontrado', 'CATALOG_NOT_FOUND');
}

function layoutData(data) {
  const isCustom = data.format === 'PERSONALIZADO';
  return {
    ...data,
    customWidth: isCustom ? data.customWidth : null,
    customHeight: isCustom ? data.customHeight : null,
  };
}

/** Crea el catálogo con una primera página vacía. */
export async function createCatalog(data, ownerId) {
  const catalog = await prisma.catalog.create({
    data: { ...layoutData(data), ownerId, pages: { create: [{ order: 0 }] } },
    include: { pages: pagesInclude },
  });
  return serializeCatalog(catalog);
}

export async function updateCatalog(id, data) {
  await assertCatalogExists(id);
  const catalog = await prisma.catalog.update({
    where: { id },
    data: layoutData(data),
    include: { pages: pagesInclude },
  });
  return serializeCatalog(catalog);
}

export async function deleteCatalog(id) {
  await assertCatalogExists(id);
  await prisma.catalog.delete({ where: { id } });
}

function copyElement(element) {
  const data = {};
  for (const [key, value] of Object.entries(element)) {
    if (!ELEMENT_COPY_OMIT.includes(key)) data[key] = value ?? undefined;
  }
  return data;
}

/** Copia profunda: configuración, páginas y elementos (con ids nuevos). */
export async function duplicateCatalog(id, ownerId) {
  const source = await prisma.catalog.findUnique({ where: { id }, include: { pages: pagesInclude } });
  if (!source) throw AppError.notFound('Catálogo no encontrado', 'CATALOG_NOT_FOUND');

  const { id: _id, createdAt, updatedAt, pages, version, ownerId: _owner, name, ...settings } = source;
  const copy = await prisma.catalog.create({
    data: {
      ...settings,
      name: `${name} (copia)`.slice(0, 120),
      ownerId,
      pages: {
        create: pages.map((page) => ({
          order: page.order,
          name: page.name,
          backgroundColor: page.backgroundColor,
          elements: { create: page.elements.map(copyElement) },
        })),
      },
    },
    include: { pages: pagesInclude },
  });
  return serializeCatalog(copy);
}

export async function getStats() {
  const [catalogs, pages, images, elements] = await Promise.all([
    prisma.catalog.count(),
    prisma.catalogPage.count(),
    prisma.image.count(),
    prisma.pageElement.count(),
  ]);
  return { catalogs, pages, images, elements };
}
