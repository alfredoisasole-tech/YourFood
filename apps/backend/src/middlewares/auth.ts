/**
 * Middleware d'authentification JWT et de vérification des rôles.
 * Conforme à AG_RULES.md (3.3 & 4.1).
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@meal-app/shared';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import type { ClientSubscriptionContext } from '../services/subscription.service';

export interface JwtPayload {
  userId: number;
  role: Role;
  nom: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      /** Abonnement courant du client, renseigné par le middleware loadClientContext */
      clientContext?: ClientSubscriptionContext;
    }
  }
}

/**
 * Vérifie la présence et la validité du token JWT dans l'en-tête Authorization.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token d\'authentification manquant');
  }

  const token = authHeader.substring(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET n\'est pas configuré sur le serveur');
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Session expirée, veuillez vous reconnecter');
    }
    throw new UnauthorizedError('Token d\'authentification invalide');
  }
}

/**
 * Restreint l'accès aux utilisateurs ayant un rôle précis (ex: admin).
 */
export function requireRole(allowedRole: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentification requise');
    }

    if (req.user.role !== allowedRole) {
      throw new ForbiddenError('Vous n\'avez pas les droits nécessaires pour cette opération');
    }

    next();
  };
}
