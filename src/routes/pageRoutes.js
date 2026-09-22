import { Router } from 'express';
import * as pages from '../controllers/pageController.js';
import * as elements from '../controllers/elementController.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import { updatePageSchema } from '../validators/pageValidators.js';
import { createElementSchema } from '../validators/elementValidators.js';

const router = Router();

router.get('/:id', validate({ params: idParams }), pages.get);
router.patch('/:id', validate({ params: idParams, body: updatePageSchema }), pages.update);
router.delete('/:id', validate({ params: idParams }), pages.remove);
router.post('/:id/duplicate', validate({ params: idParams }), pages.duplicate);
router.post('/:id/elements', validate({ params: idParams, body: createElementSchema }), elements.create);

export default router;
