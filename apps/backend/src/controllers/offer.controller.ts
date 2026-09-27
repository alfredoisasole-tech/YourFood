/**
 * Contrôleur : Offres du jour (publication côté Admin et consultation côté Client).
 * Conforme à SPEC.md (5.5, 5.6) et AG_RULES.md (4.1).
 */

import { Request, Response, NextFunction } from 'express';
import { offerService } from '../services/offer.service';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { NotFoundError, UnauthorizedError } from '../utils/errors';

export class OfferController {
  /** POST /api/admin/offers/single */
  async publishSingle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await offerService.publishSingle(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/offers/multi-days */
  async publishMultiDays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await offerService.publishMultiDays(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/offers/today */
  async getClientDailyMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscriptionId = req.user?.subscriptionId;
      if (!subscriptionId) {
        throw new UnauthorizedError('Abonnement requis pour accéder au menu');
      }

      const subscription = await subscriptionRepository.findById(subscriptionId);
      if (!subscription) {
        throw new NotFoundError('Abonnement introuvable');
      }

      const menu = await offerService.getClientDailyMenu(subscriptionId, subscription.formule);
      res.status(200).json(menu);
    } catch (err) {
      next(err);
    }
  }
}

export const offerController = new OfferController();
