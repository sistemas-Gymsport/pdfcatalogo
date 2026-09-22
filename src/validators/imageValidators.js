import { z } from 'zod';
import { optionalText } from './common.js';

export const uploadImageSchema = z.object({
  name: z.string().trim().max(120).optional().default(''),
  description: optionalText(500),
});

export const updateImageSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  description: optionalText(500),
});
