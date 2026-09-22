import { getPageSize } from '../config/pageFormats.js';

/** Datos de imagen que necesitan el editor y el renderer. */
export const imageSelect = { id: true, name: true, url: true, width: true, height: true };

export const elementInclude = { image: { select: imageSelect } };

export const pagesInclude = {
  orderBy: { order: 'asc' },
  include: {
    elements: {
      orderBy: [{ zIndex: 'asc' }, { createdAt: 'asc' }],
      include: elementInclude,
    },
  },
};

function serializeElement(element) {
  const { createdAt, updatedAt, ...rest } = element;
  return rest;
}

/** Agrega las dimensiones calculadas de la página (mm) al catálogo. */
export function serializeCatalog(catalog) {
  if (!catalog) return catalog;
  const { width, height } = getPageSize(catalog);
  const result = { ...catalog, pageWidth: width, pageHeight: height };
  if (catalog.pages) {
    result.pages = catalog.pages.map((page) => ({
      ...page,
      elements: page.elements ? page.elements.map(serializeElement) : undefined,
    }));
  }
  return result;
}
