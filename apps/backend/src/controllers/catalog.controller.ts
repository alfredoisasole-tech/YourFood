/**
 * Contrôleur : Catalogue de plats (côté Admin).
 */

import { Request, Response, NextFunction } from 'express';
import { catalogService } from '../services/catalog.service';

export class CatalogController {
  /** GET /api/admin/catalog */
  async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await catalogService.getAll();
      res.status(200).json(items);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/catalog */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await catalogService.create(req.body);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/admin/catalog/:id */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const item = await catalogService.update(id, req.body);
      res.status(200).json(item);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/admin/catalog/:id */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      res.status(200).json(await catalogService.delete(id));
    } catch (err) {
      next(err);
    }
  }
}

export const catalogController = new CatalogController();
