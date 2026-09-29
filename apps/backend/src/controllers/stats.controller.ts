/**
 * Contrôleur : Statistiques du tableau de bord admin.
 * Conforme à SPEC.md (6) et AG_RULES.md (4.1).
 */

import { Request, Response, NextFunction } from 'express';
import { statsService } from '../services/stats.service';

export class StatsController {
  /** GET /api/admin/stats/overview?date */
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(await statsService.getOverview(req.query.date as string | undefined));
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/stats/deliveries?month=YYYY-MM */
  async getDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(await statsService.getMonthlyDeliveries(req.query.month as string));
    } catch (err) {
      next(err);
    }
  }
}

export const statsController = new StatsController();
