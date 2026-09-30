/**
 * Repository pour les codes d'accès à 8 caractères.
 * Conforme à SPEC.md (section 5.2, 5.3, 8) et AG_RULES.md.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

/** Code d'accès avec l'abonnement et l'utilisateur auxquels il appartient */
export type AccessCodeWithOwner = Prisma.AccessCodeGetPayload<{
  include: { subscription: { include: { user: true } } };
}>;

export class AccessCodeRepository {
  async findByCode(code: string): Promise<AccessCodeWithOwner | null> {
    return prisma.accessCode.findUnique({
      where: { code: code.trim() },
      include: {
        subscription: {
          include: {
            user: true,
          },
        },
      },
    });
  }
}

export const accessCodeRepository = new AccessCodeRepository();
