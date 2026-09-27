/**
 * Routes : Espace Administrateur (Clients, Catalogue, Offres, Dashboard Préparation, Avis).
 * Conforme à SPEC.md (5.1, 5.2, 5.4, 5.5, 5.8, 6, 8) et AG_RULES.md (4.1).
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import {
  Role,
  publishSingleOfferSchema,
  publishMultiDaysOfferSchema,
  updatePreparationStatusSchema,
} from '@meal-app/shared';
import clientRoutes from './client.routes';
import catalogRoutes from './catalog.routes';
import { offerController } from '../controllers/offer.controller';
import { orderController } from '../controllers/order.controller';
import { reviewController } from '../controllers/review.controller';

const router = Router();

// Protection stricte : toutes les routes /api/admin nécessitent le rôle admin
router.use(authenticate, requireRole(Role.ADMIN));

// 1. Sous-routeurs modulaires
router.use('/clients', clientRoutes);
router.use('/catalog', catalogRoutes);

// 2. Publication des offres du jour (SPEC 5.5)
router.post('/offers/single', validateBody(publishSingleOfferSchema), (req, res, next) => {
  offerController.publishSingle(req, res, next);
});

router.post('/offers/multi-days', validateBody(publishMultiDaysOfferSchema), (req, res, next) => {
  offerController.publishMultiDays(req, res, next);
});

// 3. Suivi de préparation et Dashboard (SPEC 6)
router.get('/orders/live', (req, res, next) => {
  orderController.getLiveSummary(req, res, next);
});

router.patch(
  '/orders/:orderId/prepare',
  validateBody(updatePreparationStatusSchema),
  (req, res, next) => {
    orderController.updatePreparationStatus(req, res, next);
  }
);

// 4. Verrouillage manuel / forçage des commandes par défaut (SPEC 5.8 & 8)
router.post('/orders/:dailyOfferId/lock', (req, res, next) => {
  orderController.lockAndAssignDefaults(req, res, next);
});

// 5. Flux de tous les avis clients (SPEC 6)
router.get('/reviews', (req, res, next) => {
  reviewController.getAllReviews(req, res, next);
});

export default router;
