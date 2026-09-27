/**
 * Repository pour les abonnements clients.
 * Conforme à SPEC.md (section 8) et AG_RULES.md.
 */

import { Subscription, Formule, StatutAbonnement } from '@prisma/client';
import { prisma } from '../utils/prisma';

export class SubscriptionRepository {
  async findById(id: number): Promise<Subscription | null> {
    return prisma.subscription.findUnique({
      where: { id },
    });
  }

  async findActiveByUserId(userId: number): Promise<Subscription | null> {
    return prisma.subscription.findFirst({
      where: {
        userId,
        statut: StatutAbonnement.actif,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findHistoryByUserId(userId: number): Promise<Subscription[]> {
    return prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    userId: number;
    formule: Formule;
    dateDebut: Date;
    dateFin: Date;
    bonus?: string | null;
  }): Promise<Subscription> {
    return prisma.subscription.create({
      data: {
        userId: data.userId,
        formule: data.formule,
        dateDebut: data.dateDebut,
        dateFin: data.dateFin,
        bonus: data.bonus,
        statut: StatutAbonnement.actif,
      },
    });
  }

  async updateStatus(id: number, statut: StatutAbonnement): Promise<Subscription> {
    return prisma.subscription.update({
      where: { id },
      data: { statut },
    });
  }

  async countActiveSubscriptions(): Promise<number> {
    return prisma.subscription.count({
      where: { statut: StatutAbonnement.actif },
    });
  }
}

export const subscriptionRepository = new SubscriptionRepository();
