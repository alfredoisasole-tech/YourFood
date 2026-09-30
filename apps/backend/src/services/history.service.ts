/**
 * Service Métier : historique des repas d'un client (SPEC 7, écran « Historique »).
 * Lecture seule : le client voit ses propres choix passés, jamais les menus d'autres jours.
 */

import { StatutCommande, StatutOffre } from '@prisma/client';
import { ClientHistoryEntry, ClientHistoryQuery, OrderStatus } from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { fromDbDate, toDbDate } from '../utils/time';
import { normalizeName } from '../utils/loginKey';

const MAX_ENTRIES = 300;

export class HistoryService {
  /**
   * Repas déjà servis (menus verrouillés) de toutes les périodes d'abonnement du client,
   * du plus récent au plus ancien, avec filtre par dates et recherche par nom de plat.
   */
  async getClientHistory(userId: number, query: ClientHistoryQuery): Promise<ClientHistoryEntry[]> {
    const dateFilter = {
      ...(query.from ? { gte: toDbDate(query.from) } : {}),
      ...(query.to ? { lte: toDbDate(query.to) } : {}),
    };

    const orders = await prisma.order.findMany({
      where: {
        subscription: { userId },
        dailyOffer: { statut: StatutOffre.verrouille, date: dateFilter },
      },
      include: {
        dailyOffer: true,
        plat: { include: { catalogItem: true } },
        accompagnement: { include: { catalogItem: true } },
        viande: { include: { catalogItem: true } },
        review: true,
      },
      orderBy: { dailyOffer: { date: 'desc' } },
      take: MAX_ENTRIES,
    });

    const search = query.q ? normalizeName(query.q) : '';

    return orders
      .map((order): ClientHistoryEntry => ({
        orderId: order.id,
        date: fromDbDate(order.dailyOffer.date),
        statut: order.statut as unknown as OrderStatus,
        estDefaut: order.estDefaut,
        platNom: order.plat?.catalogItem.nom ?? null,
        accompagnementNom: order.accompagnement?.catalogItem.nom ?? null,
        viandeNom: order.viande?.catalogItem.nom ?? null,
        noteEtoile: order.review?.noteEtoile ?? null,
        commentaire: order.review?.commentaire ?? null,
        avisPossible: order.statut !== StatutCommande.annulee && !order.review?.rempli,
      }))
      .filter((entry) => {
        if (!search) {
          return true;
        }
        const dishes = [entry.platNom, entry.accompagnementNom, entry.viandeNom].filter(Boolean).join(' ');
        return normalizeName(dishes).includes(search);
      });
  }
}

export const historyService = new HistoryService();
