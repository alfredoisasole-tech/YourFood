/**
 * Service Métier : abonnement courant d'un client.
 *
 * L'abonnement est toujours résolu à chaque requête à partir de l'identifiant du client (jamais lu
 * dans le JWT) : ainsi un renouvellement qui prend effet un lundi est pris en compte immédiatement,
 * sans attendre que le client se reconnecte. L'état vient des dates (SPEC 5.11).
 */

import { Subscription } from '@prisma/client';
import { SubscriptionView } from '@meal-app/shared';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { getTodayDateString } from '../utils/time';
import { toSubscriptionView } from '../utils/mappers';

export interface ClientSubscriptionContext {
  subscription: Subscription;
  view: SubscriptionView;
}

export class SubscriptionService {
  /** Abonnement courant du client, ou null s'il n'en a aucun */
  async getCurrent(userId: number): Promise<ClientSubscriptionContext | null> {
    const today = getTodayDateString();
    const subscription = await subscriptionRepository.findCurrentByUserId(userId, today);
    if (!subscription) {
      return null;
    }
    return { subscription, view: toSubscriptionView(subscription, today) };
  }
}

export const subscriptionService = new SubscriptionService();
