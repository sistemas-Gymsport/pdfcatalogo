import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, changePasswordSchema } from '../validators/authValidators.js';
import { env } from '../config/env.js';

const router = Router();

// Limita intentos de login por IP para mitigar fuerza bruta.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión. Espera unos minutos.',
    errorCode: 'TOO_MANY_ATTEMPTS',
  },
});

router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
router.get('/me', requireAuth, controller.me);
router.post('/logout', requireAuth, controller.logout);
router.put('/password', requireAuth, validate({ body: changePasswordSchema }), controller.changePassword);

export default router;
