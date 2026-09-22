import { z } from 'zod';
import { elementColor, idSchema } from './common.js';
import { documentElementSchema } from './elementValidators.js';

const pageFields = {
  name: z.string().trim().max(80).optional().nullable().transform((v) => v || null),
  backgroundColor: elementColor.optional().nullable().default(null),
};

export const createPageSchema = z.object({
  ...pageFields,
  // Posición donde insertar (0 = primera). Por defecto, al final.
  position: z.coerce.number().int().min(0).optional(),
});

export const updatePageSchema = z.object({
  name: z.string().trim().max(80).nullable().optional(),
  backgroundColor: elementColor.nullable().optional(),
});

export const reorderPagesSchema = z.object({
  pageIds: z.array(idSchema).min(1),
});

export const MAX_PAGES = 200;
export const MAX_ELEMENTS_PER_PAGE = 300;

/** Documento completo que envía el editor al pulsar "Guardar". */
export const saveDocumentSchema = z
  .object({
    version: z.coerce.number().int().min(1),
    pages: z
      .array(
        z.object({
          id: idSchema,
          ...pageFields,
          elements: z.array(documentElementSchema).max(MAX_ELEMENTS_PER_PAGE, `Máximo ${MAX_ELEMENTS_PER_PAGE} elementos por página`),
        }),
      )
      .max(MAX_PAGES, `Máximo ${MAX_PAGES} páginas`),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set();
    for (const page of doc.pages) {
      for (const id of [page.id, ...page.elements.map((e) => e.id)]) {
        if (ids.has(id)) ctx.addIssue({ code: 'custom', path: ['pages'], message: `Identificador duplicado: ${id}` });
        ids.add(id);
      }
    }
  });
