import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { getCatalog } from './catalogService.js';

/**
 * Guarda el documento completo del editor (páginas + elementos) en una
 * transacción. Usa control de concurrencia optimista: si el catálogo fue
 * guardado desde otra ventana, "version" no coincide y se responde 409.
 */
export async function saveDocument(catalogId, { version, pages }) {
  const catalog = await prisma.catalog.findUnique({ where: { id: catalogId }, select: { version: true } });
  if (!catalog) throw AppError.notFound('Catálogo no encontrado', 'CATALOG_NOT_FOUND');
  if (catalog.version !== version) throw versionConflict();

  // Las imágenes eliminadas de la biblioteca se desvinculan en lugar de fallar.
  const requestedImageIds = [...new Set(pages.flatMap((p) => p.elements.map((e) => e.imageId).filter(Boolean)))];
  const existingImages = requestedImageIds.length
    ? await prisma.image.findMany({ where: { id: { in: requestedImageIds } }, select: { id: true } })
    : [];
  const validImageIds = new Set(existingImages.map((image) => image.id));

  const pageRows = pages.map((page, index) => ({
    id: page.id,
    catalogId,
    order: index,
    name: page.name,
    backgroundColor: page.backgroundColor,
  }));

  const elementRows = pages.flatMap((page) =>
    page.elements.map(({ props, imageId, ...element }) => ({
      ...element,
      pageId: page.id,
      imageId: imageId && validImageIds.has(imageId) ? imageId : null,
      props: props ?? undefined,
    })),
  );

  await prisma.$transaction(
    async (tx) => {
      const { count } = await tx.catalog.updateMany({
        where: { id: catalogId, version },
        data: { version: { increment: 1 } },
      });
      if (count === 0) throw versionConflict();

      await tx.catalogPage.deleteMany({ where: { catalogId } });
      if (pageRows.length) await tx.catalogPage.createMany({ data: pageRows });
      if (elementRows.length) await tx.pageElement.createMany({ data: elementRows });
    },
    { timeout: 30000, maxWait: 10000 },
  );

  return getCatalog(catalogId);
}

function versionConflict() {
  return AppError.conflict(
    'El catálogo fue modificado en otra ventana. Recarga para ver la última versión.',
    'VERSION_CONFLICT',
  );
}

/** Incrementa la versión cuando se modifican páginas/elementos por la API granular. */
export function bumpVersion(tx, catalogId) {
  return tx.catalog.update({ where: { id: catalogId }, data: { version: { increment: 1 } } });
}
