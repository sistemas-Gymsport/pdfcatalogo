import { z } from 'zod';
import { PAGE_FORMATS, ORIENTATIONS, CUSTOM_LIMITS, getPageSize } from '../config/pageFormats.js';
import { hexColor, optionalText } from './common.js';

const margin = z.coerce
  .number({ message: 'El margen debe ser un número' })
  .min(0, 'El margen no puede ser negativo')
  .max(100, 'El margen máximo es 100 mm');

const customSize = z.coerce
  .number()
  .min(CUSTOM_LIMITS.min, `Mínimo ${CUSTOM_LIMITS.min} mm`)
  .max(CUSTOM_LIMITS.max, `Máximo ${CUSTOM_LIMITS.max} mm`)
  .optional()
  .nullable();

const catalogFields = {
  name: z.string({ message: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(120),
  description: optionalText(1000),
  format: z.enum(Object.keys(PAGE_FORMATS), { message: 'Formato inválido' }),
  orientation: z.enum(ORIENTATIONS, { message: 'Orientación inválida' }),
  customWidth: customSize,
  customHeight: customSize,
  marginTop: margin,
  marginBottom: margin,
  marginLeft: margin,
  marginRight: margin,
  colorPrimary: hexColor,
  colorSecondary: hexColor,
  colorText: hexColor,
  colorBackground: hexColor,
};

/** Reglas que dependen de varios campos (tamaño personalizado y área útil). */
function refineLayout(data, ctx) {
  if (data.format === 'PERSONALIZADO' && (!data.customWidth || !data.customHeight)) {
    ctx.addIssue({ code: 'custom', path: ['customWidth'], message: 'Indica ancho y alto para el formato personalizado' });
    return;
  }
  const { width, height } = getPageSize(data);
  if (data.marginLeft + data.marginRight > width - 20) {
    ctx.addIssue({ code: 'custom', path: ['marginLeft'], message: 'Los márgenes laterales dejan muy poco espacio útil' });
  }
  if (data.marginTop + data.marginBottom > height - 20) {
    ctx.addIssue({ code: 'custom', path: ['marginTop'], message: 'Los márgenes superior e inferior dejan muy poco espacio útil' });
  }
}

export const createCatalogSchema = z
  .object({
    ...catalogFields,
    format: catalogFields.format.default('NORMAL'),
    orientation: catalogFields.orientation.default('PORTRAIT'),
    marginTop: margin.default(15),
    marginBottom: margin.default(15),
    marginLeft: margin.default(15),
    marginRight: margin.default(15),
    colorPrimary: hexColor.default('#F64851'),
    colorSecondary: hexColor.default('#1F2937'),
    colorText: hexColor.default('#111827'),
    colorBackground: hexColor.default('#FFFFFF'),
  })
  .superRefine(refineLayout);

/** Actualización completa de configuración (el formulario siempre envía todos los campos). */
export const updateCatalogSchema = createCatalogSchema;
