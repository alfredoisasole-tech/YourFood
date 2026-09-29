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
      if (!req.user) {
        throw new UnauthorizedError('Authentification requise');
      }
      await reviewService.submitReview(req.user.userId, req.body);
      res.status(200).json({ message: 'Avis enregistré, merci !' });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/reviews - Liste chronologique des avis pour l'admin */
  async getAllReviews(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(await reviewService.getAllReviews());
    } catch (err) {
      next(err);
    }
  }
}

export const reviewController = new ReviewController();
