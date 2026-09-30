/**
 * Repository pour les abonnements clients.
 * Conforme à SPEC.md (section 8) et AG_RULES.md.
 */

import { Subscription } from '@prisma/client';
import { pickCurrentPeriod } from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { fromDbDate } from '../utils/time';

export class SubscriptionRepository {
  async findById(id: number): Promise<Subscription | null> {
    return prisma.subscription.findUnique({
      where: { id },
    });
  }

  /** Toutes les périodes d'un client, de la plus récente à la plus ancienne */
  async findHistoryByUserId(userId: number): Promise<Subscription[]> {
    return prisma.subscription.findMany({
      where: { userId },
      orderBy: { dateDebut: 'desc' },
    });
  }

  /**
   * Période « courante » d'un client : celle qui couvre aujourd'hui, sinon la prochaine à venir,
   * sinon la plus récente (abonnement expiré). Se base sur les dates, pas sur le champ `statut`.
   */
  async findCurrentByUserId(userId: number, todayIso: string): Promise<Subscription | null> {
    const history = await this.findHistoryByUserId(userId);
    const current = pickCurrentPeriod(
      history.map((sub) => ({
        sub,
        dateDebut: fromDbDate(sub.dateDebut),
        dateFin: fromDbDate(sub.dateFin),
      })),
      todayIso
    );
    return current?.sub ?? null;
  }
}

export const subscriptionRepository = new SubscriptionRepository();
