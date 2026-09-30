/**
 * Middleware : charge l'abonnement courant du client connecté.
 * À placer après `authenticate`. Renseigne `req.clientContext`.
 */

import { Request, Response, NextFunction } from 'express';
import { Role } from '@meal-app/shared';
import { subscriptionService } from '../services/subscription.service';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export async function loadClientContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentification requise');
    }
    if (req.user.role !== Role.CLIENT) {
      throw new ForbiddenError('Cette opération est réservée aux clients');
    }

    const context = await subscriptionService.getCurrent(req.user.userId);
    if (!context) {
      throw new ForbiddenError("Aucun abonnement n'est associé à ce compte");
    }

    req.clientContext = context;
    next();
  } catch (err) {
    next(err);
  }
}
