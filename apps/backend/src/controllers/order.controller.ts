/**
 * Contrôleur : Commandes, annulations et suivi de préparation.
 * Conforme à SPEC.md (5.6, 5.7, 5.8, 6) et AG_RULES.md (4.1).
 */

import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { UnauthorizedError } from '../utils/errors';

export class OrderController {
  /** POST /api/orders - Soumettre ou modifier un choix */
  async submitOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.clientContext) {
        throw new UnauthorizedError('Abonnement requis pour commander');
      }
      res.status(200).json(await orderService.submitOrder(req.clientContext, req.body));
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/orders/:dailyOfferId/cancel - Annuler le repas du jour (même sans commande préalable) */
  async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.clientContext) {
        throw new UnauthorizedError('Abonnement requis');
      }
      const dailyOfferId = parseInt(req.params.dailyOfferId as string, 10);
      await orderService.cancelOrder(req.clientContext, dailyOfferId);
      res.status(200).json({ message: 'Repas annulé' });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/orders/live - Vue directe « Suivi du jour » */
  async getLiveSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query.date as string | undefined;
      res.status(200).json(await orderService.getLivePreparationSummary(date));
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/admin/orders/:orderId/prepare - Cocher / décocher préparé */
  async updatePreparationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = parseInt(req.params.orderId as string, 10);
      await orderService.updatePreparationStatus(orderId, Boolean(req.body.prepare));
      res.status(200).json({ message: 'Statut de préparation mis à jour' });
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/orders/:dailyOfferId/lock - Forcer le verrouillage et les commandes par défaut */
  async lockAndAssignDefaults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dailyOfferId = parseInt(req.params.dailyOfferId as string, 10);
      await orderService.lockAndAssignDefaults(dailyOfferId);
      res.status(200).json({ message: 'Offre verrouillée et commandes par défaut attribuées' });
    } catch (err) {
      next(err);
    }
  }
}

export const orderController = new OrderController();
