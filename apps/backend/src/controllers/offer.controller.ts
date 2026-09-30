/**
 * Contrôleur : Offres du jour (publication côté Admin et consultation côté Client).
 * Conforme à SPEC.md (5.5, 5.6) et AG_RULES.md (4.1).
 */

import { Request, Response, NextFunction } from 'express';
import { offerService } from '../services/offer.service';
import { UnauthorizedError } from '../utils/errors';

export class OfferController {
  /** POST /api/admin/offers/single */
  async publishSingle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await offerService.publishSingle(req.body));
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/offers/multi-days */
  async publishMultiDays(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await offerService.publishMultiDays(req.body));
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/offers?from&to */
  async listWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query as { from: string; to: string };
      res.status(200).json(await offerService.listWeek(from, to));
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/admin/offers/:date */
  async updateOffer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(await offerService.updateOffer(req.params.date as string, req.body));
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/offers/today */
  async getClientDailyMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.clientContext) {
        throw new UnauthorizedError('Abonnement requis pour accéder au menu');
      }
      res.status(200).json(await offerService.getClientDailyMenu(req.clientContext));
    } catch (err) {
      next(err);
    }
  }
}

export const offerController = new OfferController();
