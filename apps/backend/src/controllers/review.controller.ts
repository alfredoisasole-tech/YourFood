/**
 * Contrôleur : Avis et notations.
 * Conforme à SPEC.md (5.9) et AG_RULES.md (4.1).
 */

import { Request, Response, NextFunction } from 'express';
import { reviewService } from '../services/review.service';
import { UnauthorizedError } from '../utils/errors';

export class ReviewController {
  /** POST /api/reviews - Soumettre un avis sur un repas */
  async submitReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscriptionId = req.user?.subscriptionId;
      if (!subscriptionId) {
        throw new UnauthorizedError('Abonnement requis pour donner un avis');
      }

      await reviewService.submitReview(subscriptionId, req.body);
      res.status(200).json({ message: 'Avis enregistré avec succès' });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/reviews - Liste chronologique des avis pour l'admin */
  async getAllReviews(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reviews = await reviewService.getAllReviews();
      res.status(200).json(reviews);
    } catch (err) {
      next(err);
    }
  }
}

export const reviewController = new ReviewController();
