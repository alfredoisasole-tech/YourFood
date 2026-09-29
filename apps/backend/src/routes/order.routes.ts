/**
 * Routes : Commandes (Client).
 * Conforme à SPEC.md (5.6, 5.7, 7) et AG_RULES.md (4.1).
 */

import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth';
import { loadClientContext } from '../middlewares/clientContext';
import { validateBody } from '../middlewares/validate';
import { standardRateLimiter } from '../middlewares/rateLimiter';
import { submitOrderSchema } from '@meal-app/shared';

const router = Router();

// Toutes les opérations de commande nécessitent d'être connecté avec un abonnement
router.use(authenticate, standardRateLimiter, loadClientContext);

// Soumettre ou modifier son choix du jour (SPEC 5.6)
router.post('/', validateBody(submitOrderSchema), (req, res, next) => {
  orderController.submitOrder(req, res, next);
});

// Annuler son repas du jour avant 20h, même sans avoir commandé (SPEC 5.7)
router.post('/:dailyOfferId/cancel', (req, res, next) => {
  orderController.cancelOrder(req, res, next);
});

export default router;
