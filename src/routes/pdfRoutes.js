import { Router } from 'express';
import { z } from 'zod';
import * as pdf from '../controllers/pdfController.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';

const router = Router();

const downloadQuery = z.object({ disposition: z.enum(['inline', 'attachment']).optional() });
const previewQuery = z.object({ guides: z.enum(['0', '1']).optional().transform((v) => v === '1') });

router.get('/catalogs/:id', validate({ params: idParams, query: downloadQuery }), pdf.download);
router.get('/catalogs/:id/html', validate({ params: idParams, query: previewQuery }), pdf.previewHtml);

export default router;
