/**
 * Repository pour les codes d'accès à 8 caractères.
 * Conforme à SPEC.md (section 5.2, 5.3, 8) et AG_RULES.md.
 */

import { AccessCode, AccessCodeType } from '@prisma/client';
import { prisma } from '../utils/prisma';

export class AccessCodeRepository {
  async findByCode(code: string): Promise<AccessCode | null> {
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

  async create(data: {
    subscriptionId: number;
    code: string;
    type: AccessCodeType;
  }): Promise<AccessCode> {
    return prisma.accessCode.create({
      data: {
        subscriptionId: data.subscriptionId,
        code: data.code,
        type: data.type,
        utilise: false,
      },
    });
  }

  async markAsUsed(id: number): Promise<AccessCode> {
    return prisma.accessCode.update({
      where: { id },
      data: {
        utilise: true,
        dateUtilisation: new Date(),
      },
    });
  }
}

export const accessCodeRepository = new AccessCodeRepository();
