/**
 * Routes : Avis et notations (Client).
 * Conforme à SPEC.md (5.9) et AG_RULES.md (4.1).
 */

import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authenticate, requireRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { standardRateLimiter } from '../middlewares/rateLimiter';
import { Role, submitReviewSchema } from '@meal-app/shared';

const router = Router();

// Soumission d'un avis sur un repas déjà servi
router.post(
  '/',
  authenticate,
  requireRole(Role.CLIENT),
  standardRateLimiter,
  validateBody(submitReviewSchema),
  (req, res, next) => {
    reviewController.submitReview(req, res, next);
  }
);

export default router;
