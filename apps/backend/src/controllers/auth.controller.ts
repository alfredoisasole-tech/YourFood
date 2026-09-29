/**
 * Contrôleur : Authentification (login, première connexion, changement de mot de passe).
 * Conforme à AG_RULES.md (4.1) : contrôleur fin, délègue au service.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { UnauthorizedError } from '../utils/errors';

export class AuthController {
  /** POST /api/auth/verify-code */
  async verifyCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(await authService.verifyCode(req.body));
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/auth/first-login */
  async firstLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(await authService.firstLogin(req.body));
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/auth/login */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(await authService.login(req.body));
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/auth/me */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentification requise');
      }
      res.status(200).json(await authService.getSession(req.user.userId));
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/auth/change-password */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentification requise');
      }
      await authService.changePassword(req.user.userId, req.body);
      res.status(200).json({ message: 'Mot de passe modifié avec succès' });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
