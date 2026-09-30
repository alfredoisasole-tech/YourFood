/**
 * Middleware d'authentification JWT et de vérification des rôles.
 * Conforme à AG_RULES.md (3.3 & 4.1).
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import type { ClientSubscriptionContext } from '../services/subscription.service';

export interface JwtPayload {
  userId: number;
  role: Role;
  nom: string;
  /** Version du mot de passe au moment de l'émission du jeton */
  tv?: number;
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

function decodeToken(authHeader: string | undefined): JwtPayload {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError("Token d'authentification manquant");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET n'est pas configuré sur le serveur");
  }

  try {
    return jwt.verify(authHeader.substring(7), secret) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Session expirée, veuillez vous reconnecter');
    }
    throw new UnauthorizedError("Token d'authentification invalide");
  }
}

/**
 * Vérifie le jeton JWT, puis que l'utilisateur existe toujours et que son mot de passe n'a pas
 * changé depuis l'émission du jeton (sinon la session a été fermée).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = decodeToken(req.headers.authorization);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true, role: true },
    });
    if (!user || user.tokenVersion !== (payload.tv ?? 0)) {
      throw new UnauthorizedError('Session expirée, veuillez vous reconnecter');
    }

    req.user = { ...payload, role: user.role as unknown as Role };
    next();
  } catch (err) {
    next(err);
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
      throw new ForbiddenError("Vous n'avez pas les droits nécessaires pour cette opération");
    }

    next();
  };
}
