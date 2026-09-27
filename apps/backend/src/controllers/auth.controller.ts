/**
 * Contrôleur : Authentification (login, première connexion, changement de mot de passe).
 * Conforme à AG_RULES.md (4.1) : contrôleur fin, délègue au service.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export class AuthController {
  /** POST /api/auth/first-login */
  async firstLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.firstLogin(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/auth/login */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/auth/change-password */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentification requise' });
        return;
      }
      await authService.changePassword(userId, req.body);
      res.status(200).json({ message: 'Mot de passe modifié avec succès' });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
