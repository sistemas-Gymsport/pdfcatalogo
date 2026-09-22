import { z } from 'zod';
import { ELEMENT_TYPES } from '../config/elementTypes.js';
import { FONTS } from '../config/fonts.js';
import { elementColor, idSchema } from './common.js';

const num = (min, max) => z.coerce.number().min(min).max(max);

/** Esquemas base de cada campo editable (sin valores por defecto). */
const baseFields = {
  x: num(-2000, 3000),
  y: num(-2000, 3000),
  width: num(0.5, 3000),
  height: num(0.5, 3000),
  rotation: num(-360, 360),
  zIndex: z.coerce.number().int().min(-10000).max(10000),
  locked: z.boolean(),
  hidden: z.boolean(),

  content: z.string().max(20000).nullable(),

  fontSize: num(1, 500).nullable(),
  fontFamily: z.enum(FONTS.map((f) => f.family)).nullable(),
  fontWeight: z.coerce.number().int().min(100).max(900).nullable(),
  fontStyle: z.enum(['normal', 'italic']).nullable(),
  lineHeight: num(0.5, 5).nullable(),
  letterSpacing: num(-10, 50).nullable(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).nullable(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).nullable(),

  color: elementColor.nullable(),
  backgroundColor: elementColor.nullable(),

  borderWidth: num(0, 50).nullable(),
  borderColor: elementColor.nullable(),
  borderStyle: z.enum(['solid', 'dashed', 'dotted', 'none']).nullable(),
  borderRadius: num(0, 1000).nullable(),
  padding: num(0, 100).nullable(),
  opacity: num(0, 1).nullable(),

  imageId: idSchema.nullable(),
  objectFit: z.enum(['cover', 'contain', 'fill']).nullable(),

  props: z.record(z.string(), z.any()).nullable(),
};

const REQUIRED = ['x', 'y', 'width', 'height'];
const DEFAULTS = { rotation: 0, zIndex: 0, locked: false, hidden: false };

/** Campos para crear: geometría obligatoria, el resto con valor por defecto. */
const createFields = Object.fromEntries(
  Object.entries(baseFields).map(([key, schema]) => {
    if (REQUIRED.includes(key)) return [key, schema];
    if (key in DEFAULTS) return [key, schema.default(DEFAULTS[key])];
    return [key, schema.optional().default(null)];
  }),
);

export const elementSchema = z.object({
  type: z.enum(ELEMENT_TYPES, { message: 'Tipo de elemento inválido' }),
  ...createFields,
});

/** Elemento dentro del documento: el id lo genera el editor (UUID). */
export const documentElementSchema = elementSchema.extend({ id: idSchema });

export const createElementSchema = elementSchema;

/** Actualización parcial: solo se validan y guardan los campos enviados. */
export const updateElementSchema = z
  .object(baseFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'No hay cambios para guardar');
