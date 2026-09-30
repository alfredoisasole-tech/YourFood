/**
 * Contrôleur : Gestion des Clients (côté Admin).
 * Conforme à AG_RULES.md (4.1) : contrôleur fin, délègue au service.
 */

import { Request, Response, NextFunction } from 'express';
import { ClientListFilter } from '@meal-app/shared';
import { clientService } from '../services/client.service';
import { historyService } from '../services/history.service';
import { UnauthorizedError } from '../utils/errors';

export class ClientController {
  /** POST /api/admin/clients */
  async createClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await clientService.createClient(req.body));
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/clients?q&etat */
  async listClients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, etat } = req.query as { q?: string; etat?: ClientListFilter };
      res.status(200).json(await clientService.listClients({ q, etat }));
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/clients/:id */
  async getClientDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id as string, 10);
      res.status(200).json(await clientService.getClientDetail(userId));
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/admin/clients/:id */
  async updateClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Number.parseInt(req.params.id as string, 10);
      res.status(200).json(await clientService.updateClient(userId, req.body));
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/clients/:id/resend-welcome */
  async resendWelcome(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id as string, 10);
      res.status(200).json(await clientService.resendWelcome(userId));
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/clients/:subscriptionId/reset-password */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscriptionId = parseInt(req.params.subscriptionId as string, 10);
      res.status(200).json(await clientService.resetPassword(subscriptionId));
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/clients/:subscriptionId/renew */
  async renewSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscriptionId = parseInt(req.params.subscriptionId as string, 10);
      res.status(200).json(await clientService.renewSubscription(subscriptionId, req.body));
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/client/history?from&to&q - Historique du client connecté */
  async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentification requise');
      }
      res.status(200).json(await historyService.getClientHistory(req.user.userId, req.query));
    } catch (err) {
      next(err);
    }
  }
}

export const clientController = new ClientController();
