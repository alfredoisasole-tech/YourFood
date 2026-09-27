/**
 * Contrôleur : Gestion des Clients (côté Admin).
 * Conforme à AG_RULES.md (4.1) : contrôleur fin, délègue au service.
 */

import { Request, Response, NextFunction } from 'express';
import { clientService } from '../services/client.service';

export class ClientController {
  /** POST /api/admin/clients */
  async createClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clientService.createClient(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/clients */
  async getAllClients(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clients = await clientService.getAllClients();
      res.status(200).json(clients);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/clients/:id */
  async getClientDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id as string, 10);
      const detail = await clientService.getClientDetail(userId);
      res.status(200).json(detail);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/clients/:id/reset-password */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscriptionId = parseInt(req.params.subscriptionId as string, 10);
      const result = await clientService.resetPassword(subscriptionId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/clients/:id/renew */
  async renewSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscriptionId = parseInt(req.params.subscriptionId as string, 10);
      const result = await clientService.renewSubscription(subscriptionId, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const clientController = new ClientController();
