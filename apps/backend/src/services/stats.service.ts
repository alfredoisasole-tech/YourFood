/**
 * Service Métier : statistiques du tableau de bord admin (SPEC 6, écran « Statistiques »).
 *
 * Définitions :
 * - clients actifs : abonnement en cours ou bientôt expiré ;
 * - livraisons d'un jour : clients dont l'abonnement couvre ce jour, moins ceux qui ont annulé ;
 * - « à renouveler » : abonnements bientôt expirés ;
 * - plat le plus commandé : par semaine, mois, année (en cours) et depuis le début.
 */

import { Prisma, StatutCommande } from '@prisma/client';
import {
  DeliveryDayStat,
  ItemCategory,
  StatsOverview,
  TopDish,
  TopDishPeriod,
  addDays,
  dayOfWeek,
  getSubscriptionState,
  isSubscriptionRunning,
  isWeekday,
  pickCurrentPeriod,
} from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { fromDbDate, getTodayDateString, toDbDate } from '../utils/time';

interface Period {
  dateDebut: string;
  dateFin: string;
}

function countCovering(periods: Period[], date: string): number {
  return periods.filter((p) => p.dateDebut <= date && date <= p.dateFin).length;
}

export class StatsService {
  async getOverview(dateStr?: string): Promise<StatsOverview> {
    const date = dateStr ?? getTodayDateString();

    const users = await prisma.user.findMany({
      where: { role: 'client' },
      include: { subscriptions: true },
    });

    let clientsActifs = 0;
    let aRenouveler = 0;
    const periods: Period[] = [];
    for (const user of users) {
      const userPeriods = user.subscriptions.map((sub) => ({
        dateDebut: fromDbDate(sub.dateDebut),
        dateFin: fromDbDate(sub.dateFin),
      }));
      periods.push(...userPeriods);

      const current = pickCurrentPeriod(userPeriods, date);
      if (!current) continue;
      const { etat } = getSubscriptionState(current, date);
      if (isSubscriptionRunning(etat)) clientsActifs++;
      if (etat === 'bientot_expire') aRenouveler++;
    }

    const dayOrders = await prisma.order.findMany({
      where: { dailyOffer: { date: toDbDate(date) } },
      include: {
        plat: { include: { catalogItem: true } },
        accompagnement: { include: { catalogItem: true } },
        viande: { include: { catalogItem: true } },
      },
    });
    const active = dayOrders.filter((o) => o.statut !== StatutCommande.annulee);
    const cancelled = dayOrders.length - active.length;

    const totals: Record<ItemCategory, Map<string, number>> = {
      [ItemCategory.PLAT]: new Map(),
      [ItemCategory.ACCOMPAGNEMENT]: new Map(),
      [ItemCategory.VIANDE]: new Map(),
    };
    const bump = (categorie: ItemCategory, nom?: string): void => {
      if (nom) totals[categorie].set(nom, (totals[categorie].get(nom) ?? 0) + 1);
    };
    for (const order of active) {
      bump(ItemCategory.PLAT, order.plat?.catalogItem.nom);
      bump(ItemCategory.ACCOMPAGNEMENT, order.accompagnement?.catalogItem.nom);
      bump(ItemCategory.VIANDE, order.viande?.catalogItem.nom);
    }

    const reviews = await prisma.review.findMany({ where: { rempli: true }, select: { noteEtoile: true } });
    const notes = reviews.map((r) => r.noteEtoile).filter((n): n is number => n !== null);

    return {
      date,
      clientsActifs,
      clientsTotal: users.length,
      livraisons: countCovering(periods, date) - cancelled,
      avis: {
        moyenne: notes.length ? Number((notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1)) : null,
        total: reviews.length,
      },
      platsPlusCommandes: await this.getTopDishes(date),
      aRenouveler,
      totauxParCategorie: [ItemCategory.PLAT, ItemCategory.ACCOMPAGNEMENT, ItemCategory.VIANDE].map(
        (categorie) => {
          const items = Array.from(totals[categorie].entries())
            .map(([nom, quantite]) => ({ nom, quantite }))
            .sort((a, b) => b.quantite - a.quantite);
          return { categorie, items, total: items.reduce((sum, item) => sum + item.quantite, 0) };
        }
      ),
    };
  }

  /**
   * Plat le plus commandé sur la semaine (depuis le lundi), le mois et l'année en cours jusqu'à `date`,
   * et depuis le début. Les commandes annulées ne comptent pas.
   */
  private async getTopDishes(date: string): Promise<Record<TopDishPeriod, TopDish | null>> {
    const monday = addDays(date, -((dayOfWeek(date) + 6) % 7));
    const [semaine, mois, annee, historique] = await Promise.all([
      this.getTopDish(monday, date),
      this.getTopDish(`${date.slice(0, 7)}-01`, date),
      this.getTopDish(`${date.slice(0, 4)}-01-01`, date),
      this.getTopDish(null, date),
    ]);
    return { semaine, mois, annee, historique };
  }

  /** Plat le plus commandé entre deux dates (comptage par plat du catalogue, pas par menu du jour) */
  private async getTopDish(from: string | null, to: string): Promise<TopDish | null> {
    const fromClause = from ? Prisma.sql`AND d.date >= ${toDbDate(from)}` : Prisma.empty;
    const rows = await prisma.$queryRaw<{ nom: string; quantite: bigint }[]>(Prisma.sql`
      SELECT ci.nom AS nom, COUNT(*) AS quantite
      FROM orders o
      JOIN offer_options oo ON oo.id = o.plat_id
      JOIN catalog_items ci ON ci.id = oo.catalog_item_id
      JOIN daily_offers d ON d.id = o.daily_offer_id
      WHERE o.statut <> 'annulee' AND d.date <= ${toDbDate(to)} ${fromClause}
      GROUP BY ci.id, ci.nom
      ORDER BY quantite DESC, ci.nom ASC
      LIMIT 1
    `);
    const top = rows[0];
    return top ? { nom: top.nom, quantite: Number(top.quantite) } : null;
  }

  /** Livraisons par jour ouvré d'un mois (« YYYY-MM »), les jours à venir étant des prévisions */
  async getMonthlyDeliveries(month: string): Promise<DeliveryDayStat[]> {
    const today = getTodayDateString();
    const first = `${month}-01`;
    const days: string[] = [];
    for (let day = first; day.startsWith(month); day = addDays(day, 1)) {
      if (isWeekday(day)) days.push(day);
    }
    const last = days[days.length - 1];
    if (!last) return [];

    const subscriptions = await prisma.subscription.findMany({
      where: { dateDebut: { lte: toDbDate(last) }, dateFin: { gte: toDbDate(first) } },
      select: { dateDebut: true, dateFin: true },
    });
    const periods = subscriptions.map((s) => ({
      dateDebut: fromDbDate(s.dateDebut),
      dateFin: fromDbDate(s.dateFin),
    }));

    const cancelledOrders = await prisma.order.findMany({
      where: {
        statut: StatutCommande.annulee,
        dailyOffer: { date: { gte: toDbDate(first), lte: toDbDate(last) } },
      },
      select: { dailyOffer: { select: { date: true } } },
    });
    const cancelledByDate = new Map<string, number>();
    for (const order of cancelledOrders) {
      const key = fromDbDate(order.dailyOffer.date);
      cancelledByDate.set(key, (cancelledByDate.get(key) ?? 0) + 1);
    }

    return days.map((date) => {
      const covering = countCovering(periods, date);
      const livraisons = covering - (cancelledByDate.get(date) ?? 0);
      return {
        date,
        livraisons,
        pourcentage: covering > 0 ? Math.round((livraisons / covering) * 100) : 0,
        prevu: date > today,
      };
    });
  }
}

export const statsService = new StatsService();
