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
      const subscriptionId = req.user?.subscriptionId;
      if (!subscriptionId) {
        throw new UnauthorizedError('Abonnement requis pour commander');
      }

      const result = await orderService.submitOrder(subscriptionId, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/orders/:dailyOfferId/cancel - Annuler la commande */
  async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscriptionId = req.user?.subscriptionId;
      if (!subscriptionId) {
        throw new UnauthorizedError('Abonnement requis');
      }

      const dailyOfferId = parseInt(req.params.dailyOfferId as string, 10);
      await orderService.cancelOrder(subscriptionId, dailyOfferId);
      res.status(200).json({ message: 'Commande annulée avec succès' });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/orders/live - Vue directe dashboard préparation */
  async getLiveSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query.date as string | undefined;
      const summary = await orderService.getLivePreparationSummary(date);
      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/admin/orders/:orderId/prepare - Cocher / décocher préparé */
  async updatePreparationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = parseInt(req.params.orderId as string, 10);
      const { prepare } = req.body;
      await orderService.updatePreparationStatus(orderId, Boolean(prepare));
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
