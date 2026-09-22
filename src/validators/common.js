import { z } from 'zod';
import { COLOR_TOKENS } from '../config/elementTypes.js';

// Mensajes de validación por defecto en español.
z.config(z.locales.es());

export const idSchema = z.uuid({ message: 'Identificador inválido' });

export const idParams = z.object({ id: idSchema });

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Normaliza #abc → #AABBCC */
export const normalizeHex = (value) => {
  let hex = value.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex.toUpperCase()}`;
};

export const hexColor = z
  .string()
  .trim()
  .regex(HEX_REGEX, 'Color HEX inválido (ej. #F64851)')
  .transform(normalizeHex);

/** Color de elemento: HEX, token del catálogo o "transparent". */
export const elementColor = z.union([
  hexColor,
  z.enum([...Object.keys(COLOR_TOKENS), 'transparent']),
]);

export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const paginationQuery = z.object({
  search: z.string().trim().max(100).optional().default(''),
});
