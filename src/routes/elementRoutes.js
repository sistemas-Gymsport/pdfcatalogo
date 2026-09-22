import { Router } from 'express';
import * as elements from '../controllers/elementController.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import { updateElementSchema } from '../validators/elementValidators.js';

const router = Router();

router.get('/:id', validate({ params: idParams }), elements.get);
router.patch('/:id', validate({ params: idParams, body: updateElementSchema }), elements.update);
router.delete('/:id', validate({ params: idParams }), elements.remove);

export default router;
