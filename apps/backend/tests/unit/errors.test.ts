import { describe, it, expect } from 'vitest';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../src/utils/errors';

describe('Application Error Classes', () => {
  it('instancie correctement AppError avec son statusCode', () => {
    const err = new AppError('Erreur custom', 503, { reason: 'maintenance' });
    expect(err.message).toBe('Erreur custom');
    expect(err.statusCode).toBe(503);
    expect(err.isOperational).toBe(true);
    expect(err.details).toEqual({ reason: 'maintenance' });
  });

  it('fournit les bons statusCodes par défaut pour chaque sous-classe', () => {
    expect(new BadRequestError().statusCode).toBe(400);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new ConflictError().statusCode).toBe(409);
  });
});
