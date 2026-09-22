import { Router } from 'express';
import * as images from '../controllers/imageController.js';
import { validate } from '../middlewares/validate.js';
import { uploadImage } from '../middlewares/upload.js';
import { idParams, paginationQuery } from '../validators/common.js';
import { updateImageSchema } from '../validators/imageValidators.js';

const router = Router();

router.get('/', validate({ query: paginationQuery }), images.list);
router.post('/', uploadImage, images.upload);
router.get('/:id', validate({ params: idParams }), images.get);
router.patch('/:id', validate({ params: idParams, body: updateImageSchema }), images.update);
router.delete('/:id', validate({ params: idParams }), images.remove);

export default router;
