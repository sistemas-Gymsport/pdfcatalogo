import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { elementInclude } from './catalogSerializer.js';
import { assertCatalogExists } from './catalogService.js';
import { bumpVersion } from './documentService.js';

const pageWithElements = {
  elements: { orderBy: [{ zIndex: 'asc' }, { createdAt: 'asc' }], include: elementInclude },
};

async function findPage(pageId) {
  const page = await prisma.catalogPage.findUnique({ where: { id: pageId }, include: pageWithElements });
  if (!page) throw AppError.notFound('Página no encontrada', 'PAGE_NOT_FOUND');
  return page;
}

export async function listPages(catalogId) {
  await assertCatalogExists(catalogId);
  return prisma.catalogPage.findMany({ where: { catalogId }, orderBy: { order: 'asc' }, include: pageWithElements });
}

export const getPage = findPage;

/** Inserta una página en la posición indicada (por defecto al final). */
export async function createPage(catalogId, { name, backgroundColor, position }) {
  await assertCatalogExists(catalogId);
  return prisma.$transaction(async (tx) => {
    const count = await tx.catalogPage.count({ where: { catalogId } });
    const order = position === undefined ? count : Math.min(position, count);
    await tx.catalogPage.updateMany({ where: { catalogId, order: { gte: order } }, data: { order: { increment: 1 } } });
    const page = await tx.catalogPage.create({
      data: { catalogId, order, name, backgroundColor },
      include: pageWithElements,
    });
    await bumpVersion(tx, catalogId);
    return page;
  });
}

export async function updatePage(pageId, data) {
  const page = await findPage(pageId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.catalogPage.update({ where: { id: pageId }, data, include: pageWithElements });
    await bumpVersion(tx, page.catalogId);
    return updated;
  });
}

async function normalizeOrder(tx, catalogId) {
  const pages = await tx.catalogPage.findMany({ where: { catalogId }, orderBy: { order: 'asc' }, select: { id: true } });
  await Promise.all(pages.map((page, index) => tx.catalogPage.update({ where: { id: page.id }, data: { order: index } })));
}

export async function deletePage(pageId) {
  const page = await findPage(pageId);
  const total = await prisma.catalogPage.count({ where: { catalogId: page.catalogId } });
  if (total <= 1) throw AppError.badRequest('El catálogo debe tener al menos una página', 'LAST_PAGE');

  await prisma.$transaction(async (tx) => {
    await tx.catalogPage.delete({ where: { id: pageId } });
    await normalizeOrder(tx, page.catalogId);
    await bumpVersion(tx, page.catalogId);
  });
}

/** Duplica la página (con sus elementos) justo después de la original. */
export async function duplicatePage(pageId) {
  const source = await findPage(pageId);
  return prisma.$transaction(async (tx) => {
    await tx.catalogPage.updateMany({
      where: { catalogId: source.catalogId, order: { gt: source.order } },
      data: { order: { increment: 1 } },
    });
    const copy = await tx.catalogPage.create({
      data: {
        catalogId: source.catalogId,
        order: source.order + 1,
        name: source.name,
        backgroundColor: source.backgroundColor,
        elements: {
          create: source.elements.map(({ id, pageId: _p, createdAt, updatedAt, image, props, ...element }) => ({
            ...element,
            props: props ?? undefined,
          })),
        },
      },
      include: pageWithElements,
    });
    await bumpVersion(tx, source.catalogId);
    return copy;
  });
}

/** Reordena todas las páginas del catálogo según la lista de ids recibida. */
export async function reorderPages(catalogId, pageIds) {
  await assertCatalogExists(catalogId);
  const current = await prisma.catalogPage.findMany({ where: { catalogId }, select: { id: true } });
  const currentIds = new Set(current.map((p) => p.id));
  const sameSet = pageIds.length === currentIds.size && pageIds.every((id) => currentIds.has(id));
  if (!sameSet) {
    throw AppError.badRequest('La lista debe contener exactamente las páginas del catálogo', 'INVALID_PAGE_ORDER');
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(pageIds.map((id, index) => tx.catalogPage.update({ where: { id }, data: { order: index } })));
    await bumpVersion(tx, catalogId);
  });
  return listPages(catalogId);
}
