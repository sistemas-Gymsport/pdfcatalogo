import { Router } from 'express';
import * as controller from '../controllers/userController.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import { createUserSchema, updateUserSchema } from '../validators/authValidators.js';

const router = Router();

router.get('/', controller.list);
router.post('/', validate({ body: createUserSchema }), controller.create);
router.patch('/:id', validate({ params: idParams, body: updateUserSchema }), controller.updateStatus);

export default router;
