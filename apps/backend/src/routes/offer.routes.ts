/**
 * Routes : Offres de repas (Client).
 * Conforme à SPEC.md (5.6, 7) et AG_RULES.md (4.1).
 */

import { Router } from 'express';
import { offerController } from '../controllers/offer.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Menu du jour personnalisé pour le client connecté
router.get('/today', authenticate, (req, res, next) => {
  offerController.getClientDailyMenu(req, res, next);
});

export default router;
