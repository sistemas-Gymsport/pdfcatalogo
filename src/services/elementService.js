import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { elementInclude } from './catalogSerializer.js';
import { bumpVersion } from './documentService.js';

async function findElement(elementId) {
  const element = await prisma.pageElement.findUnique({
    where: { id: elementId },
    include: { ...elementInclude, page: { select: { catalogId: true } } },
  });
  if (!element) throw AppError.notFound('Elemento no encontrado', 'ELEMENT_NOT_FOUND');
  return element;
}

async function assertImageExists(imageId) {
  if (!imageId) return;
  const image = await prisma.image.findUnique({ where: { id: imageId }, select: { id: true } });
  if (!image) throw AppError.badRequest('La imagen seleccionada no existe', 'IMAGE_NOT_FOUND');
}

const toData = ({ props, ...data }) => (props === undefined ? data : { ...data, props: props ?? undefined });

export async function getElement(elementId) {
  const { page, ...element } = await findElement(elementId);
  return element;
}

export async function createElement(pageId, data) {
  const page = await prisma.catalogPage.findUnique({ where: { id: pageId }, select: { catalogId: true } });
  if (!page) throw AppError.notFound('Página no encontrada', 'PAGE_NOT_FOUND');
  await assertImageExists(data.imageId);

  return prisma.$transaction(async (tx) => {
    const element = await tx.pageElement.create({ data: { ...toData(data), pageId }, include: elementInclude });
    await bumpVersion(tx, page.catalogId);
    return element;
  });
}

export async function updateElement(elementId, data) {
  const current = await findElement(elementId);
  await assertImageExists(data.imageId);

  return prisma.$transaction(async (tx) => {
    const element = await tx.pageElement.update({ where: { id: elementId }, data: toData(data), include: elementInclude });
    await bumpVersion(tx, current.page.catalogId);
    return element;
  });
}

export async function deleteElement(elementId) {
  const current = await findElement(elementId);
  await prisma.$transaction(async (tx) => {
    await tx.pageElement.delete({ where: { id: elementId } });
    await bumpVersion(tx, current.page.catalogId);
  });
}
