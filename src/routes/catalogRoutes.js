import { Router } from 'express';
import * as catalogs from '../controllers/catalogController.js';
import * as pages from '../controllers/pageController.js';
import { validate } from '../middlewares/validate.js';
import { idParams, paginationQuery } from '../validators/common.js';
import { createCatalogSchema, updateCatalogSchema } from '../validators/catalogValidators.js';
import { createPageSchema, reorderPagesSchema, saveDocumentSchema } from '../validators/pageValidators.js';

const router = Router();

router.get('/', validate({ query: paginationQuery }), catalogs.list);
router.post('/', validate({ body: createCatalogSchema }), catalogs.create);
router.get('/:id', validate({ params: idParams }), catalogs.get);
router.put('/:id', validate({ params: idParams, body: updateCatalogSchema }), catalogs.update);
router.delete('/:id', validate({ params: idParams }), catalogs.remove);
router.post('/:id/duplicate', validate({ params: idParams }), catalogs.duplicate);

// Guardado del documento completo desde el editor.
router.put('/:id/document', validate({ params: idParams, body: saveDocumentSchema }), catalogs.saveDocument);

// Páginas del catálogo.
router.get('/:id/pages', validate({ params: idParams }), pages.list);
router.post('/:id/pages', validate({ params: idParams, body: createPageSchema }), pages.create);
router.put('/:id/pages/order', validate({ params: idParams, body: reorderPagesSchema }), pages.reorder);

export default router;
