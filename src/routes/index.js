import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import * as system from '../controllers/systemController.js';
import { stats } from '../controllers/catalogController.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import pageRoutes from './pageRoutes.js';
import elementRoutes from './elementRoutes.js';
import imageRoutes from './imageRoutes.js';
import pdfRoutes from './pdfRoutes.js';

const router = Router();

// Públicas
router.get('/health', system.health);
router.use('/auth', authRoutes);

// Protegidas: requieren sesión de administrador
const admin = [requireAuth, requireRole('ADMIN')];
router.get('/config', admin, system.editorConfig);
router.get('/stats', admin, stats);
router.use('/users', admin, userRoutes);
router.use('/catalogs', admin, catalogRoutes);
router.use('/pages', admin, pageRoutes);
router.use('/elements', admin, elementRoutes);
router.use('/images', admin, imageRoutes);
router.use('/pdf', admin, pdfRoutes);

export default router;
