/**
 * Middleware centralisé de gestion des erreurs Express.
 * Conforme à AG_RULES.md (2.4, 3.3, 4.1).
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Erreur applicative opérationnelle typée
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // 2. Erreurs Prisma connues
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') ?? 'champ unique';
      res.status(409).json({
        error: `Une ressource existe déjà avec cette valeur (${target})`,
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        error: 'La ressource demandée n\'existe pas',
      });
      return;
    }
  }

  // 3. Erreur inattendue / bug serveur (500)
  // eslint-disable-next-line no-console
  console.error('💥 Erreur interne non gérée :', err);

  res.status(500).json({
    error: 'Une erreur interne est survenue sur le serveur',
  });
}
