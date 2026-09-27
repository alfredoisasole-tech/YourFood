/**
 * Routes : Commandes (Client).
 * Conforme à SPEC.md (5.6, 5.7, 7) et AG_RULES.md (4.1).
 */

import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { standardRateLimiter } from '../middlewares/rateLimiter';
import { submitOrderSchema } from '@meal-app/shared';

const router = Router();

// Toutes les opérations de commande nécessitent d'être connecté
router.use(authenticate, standardRateLimiter);

// Soumettre ou modifier son choix du jour (SPEC 5.6)
router.post('/', validateBody(submitOrderSchema), (req, res, next) => {
  orderController.submitOrder(req, res, next);
});

// Annuler sa commande du jour avant 20h (SPEC 5.7)
router.post('/:dailyOfferId/cancel', (req, res, next) => {
  orderController.cancelOrder(req, res, next);
});

export default router;
