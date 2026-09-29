/**
 * Routes : Espace Administrateur (Clients, Catalogue, Offres, Suivi, Avis, Statistiques).
 * Conforme à SPEC.md (5.1, 5.2, 5.4, 5.5, 5.8, 6, 8) et AG_RULES.md (4.1).
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validateBody, validateQuery } from '../middlewares/validate';
import {
  Role,
  publishSingleOfferSchema,
  publishMultiDaysOfferSchema,
  updateOfferSchema,
  offerRangeQuerySchema,
  updatePreparationStatusSchema,
  liveSummaryQuerySchema,
  statsOverviewQuerySchema,
  deliveriesQuerySchema,
} from '@meal-app/shared';
import clientRoutes from './client.routes';
import catalogRoutes from './catalog.routes';
import { offerController } from '../controllers/offer.controller';
import { orderController } from '../controllers/order.controller';
import { reviewController } from '../controllers/review.controller';
import { statsController } from '../controllers/stats.controller';

const router = Router();

// Protection stricte : toutes les routes /api/admin nécessitent le rôle admin
router.use(authenticate, requireRole(Role.ADMIN));

// 1. Sous-routeurs modulaires
router.use('/clients', clientRoutes);
router.use('/catalog', catalogRoutes);

// 2. Menus : consultation d'une plage, publication et modification (SPEC 5.5)
router.get('/offers', validateQuery(offerRangeQuerySchema), (req, res, next) => {
  offerController.listWeek(req, res, next);
});

router.post('/offers/single', validateBody(publishSingleOfferSchema), (req, res, next) => {
  offerController.publishSingle(req, res, next);
});

router.post('/offers/multi-days', validateBody(publishMultiDaysOfferSchema), (req, res, next) => {
  offerController.publishMultiDays(req, res, next);
});

router.put('/offers/:date', validateBody(updateOfferSchema), (req, res, next) => {
  offerController.updateOffer(req, res, next);
});

// 3. Suivi de préparation (SPEC 6)
router.get('/orders/live', validateQuery(liveSummaryQuerySchema), (req, res, next) => {
  orderController.getLiveSummary(req, res, next);
});

router.patch(
  '/orders/:orderId/prepare',
  validateBody(updatePreparationStatusSchema),
  (req, res, next) => {
    orderController.updatePreparationStatus(req, res, next);
  }
);

// 4. Verrouillage manuel d'un menu (le verrouillage à 20h est automatique, SPEC 5.8)
router.post('/orders/:dailyOfferId/lock', (req, res, next) => {
  orderController.lockAndAssignDefaults(req, res, next);
});

// 5. Flux de tous les avis clients (SPEC 6)
router.get('/reviews', (req, res, next) => {
  reviewController.getAllReviews(req, res, next);
});

// 6. Statistiques (SPEC 6)
router.get('/stats/overview', validateQuery(statsOverviewQuerySchema), (req, res, next) => {
  statsController.getOverview(req, res, next);
});

router.get('/stats/deliveries', validateQuery(deliveriesQuerySchema), (req, res, next) => {
  statsController.getDeliveries(req, res, next);
});

export default router;
