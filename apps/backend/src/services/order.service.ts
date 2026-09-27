/**
 * Service Métier : Commandes, annulation, commande par défaut, verrouillage.
 * Conforme à SPEC.md (5.6, 5.7, 5.8, 8) et AG_RULES.md.
 */

import {
  SubmitOrderDto,
  OrderStatus,
  LivePreparationSummary,
  ClientOrderDetailRow,
  DailyOfferStatus,
} from '@meal-app/shared';
import { StatutCommande, StatutOffre, CategorieItem, StatutAbonnement } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { isPastAbsoluteDeadline, getTodayDateString } from '../utils/time';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import dayjs from 'dayjs';

export class OrderService {
  /**
   * Prise de commande ou modification du choix par le client (SPEC 5.6).
   */
  async submitOrder(subscriptionId: number, dto: SubmitOrderDto): Promise<{ orderId: number }> {
    if (isPastAbsoluteDeadline()) {
      throw new ForbiddenError('Le menu est verrouillé après 20h. Aucune modification possible.');
    }

    const offer = await prisma.dailyOffer.findUnique({ where: { id: dto.dailyOfferId } });
    if (!offer || offer.statut === StatutOffre.verrouille) {
      throw new ForbiddenError('L\'offre du jour est verrouillée.');
    }

    // Vérifier que les options choisies appartiennent bien à l'offre
    const optionIds = [dto.platOptionId, dto.accompagnementOptionId];
    if (dto.viandeOptionId) optionIds.push(dto.viandeOptionId);

    const validOptions = await prisma.offerOption.findMany({
      where: { id: { in: optionIds }, dailyOfferId: dto.dailyOfferId },
      include: { catalogItem: true },
    });

    if (validOptions.length !== optionIds.length) {
      throw new BadRequestError('Une ou plusieurs options choisies ne sont pas valides pour cette offre.');
    }

    // Vérifier les catégories
    const platOption = validOptions.find((o) => o.catalogItem.categorie === CategorieItem.plat);
    const accOption = validOptions.find((o) => o.catalogItem.categorie === CategorieItem.accompagnement);

    if (!platOption || !accOption) {
      throw new BadRequestError('Vous devez choisir un plat et un accompagnement.');
    }

    // Upsert : créer ou mettre à jour la commande du jour
    const existing = await prisma.order.findFirst({
      where: { dailyOfferId: dto.dailyOfferId, subscriptionId },
    });

    if (existing) {
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          platId: dto.platOptionId,
          accompagnementId: dto.accompagnementOptionId,
          viandeId: dto.viandeOptionId ?? null,
          statut: StatutCommande.en_attente,
          estDefaut: false,
        },
      });
      return { orderId: existing.id };
    }

    const order = await prisma.order.create({
      data: {
        dailyOfferId: dto.dailyOfferId,
        subscriptionId,
        platId: dto.platOptionId,
        accompagnementId: dto.accompagnementOptionId,
        viandeId: dto.viandeOptionId ?? null,
        statut: StatutCommande.en_attente,
        estDefaut: false,
        prepare: false,
      },
    });

    return { orderId: order.id };
  }

  /**
   * Annulation de la commande du jour par le client (SPEC 5.7).
   */
  async cancelOrder(subscriptionId: number, dailyOfferId: number): Promise<void> {
    if (isPastAbsoluteDeadline()) {
      throw new ForbiddenError('Annulation impossible après 20h.');
    }

    const order = await prisma.order.findFirst({
      where: { dailyOfferId, subscriptionId },
    });

    if (!order) {
      throw new NotFoundError('Aucune commande trouvée pour ce jour.');
    }

    if (order.statut === StatutCommande.annulee) {
      throw new BadRequestError('Cette commande est déjà annulée.');
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { statut: StatutCommande.annulee },
    });
  }

  /**
   * Processus de verrouillage à 20h et attribution des commandes par défaut (SPEC 5.8 & 8).
   * Déclenché automatiquement par requête si now() >= 20h et l'offre n'est pas encore verrouillée.
   */
  async lockAndAssignDefaults(dailyOfferId: number): Promise<void> {
    const offer = await prisma.dailyOffer.findUnique({
      where: { id: dailyOfferId },
      include: { options: { include: { catalogItem: true } } },
    });

    if (!offer || offer.statut === StatutOffre.verrouille) {
      return; // Déjà verrouillé ou inexistant
    }

    // 1. Trouver tous les abonnements actifs
    const activeSubscriptions = await prisma.subscription.findMany({
      where: { statut: StatutAbonnement.actif },
    });

    // 2. Trouver les abonnements qui n'ont pas de commande (ou annulée)
    const existingOrders = await prisma.order.findMany({
      where: {
        dailyOfferId,
        statut: { not: StatutCommande.annulee },
      },
    });

    const orderedSubIds = new Set(existingOrders.map((o) => o.subscriptionId));

    const missingSubscriptions = activeSubscriptions.filter(
      (s) => !orderedSubIds.has(s.id)
    );

    if (missingSubscriptions.length > 0) {
      // 3. Pour chaque catégorie, calculer l'option la plus demandée
      const platCounts = new Map<number, number>();
      const accCounts = new Map<number, number>();
      const viandeCounts = new Map<number, number>();

      for (const order of existingOrders) {
        platCounts.set(order.platId, (platCounts.get(order.platId) ?? 0) + 1);
        accCounts.set(order.accompagnementId, (accCounts.get(order.accompagnementId) ?? 0) + 1);
        if (order.viandeId) {
          viandeCounts.set(order.viandeId, (viandeCounts.get(order.viandeId) ?? 0) + 1);
        }
      }

      const defaultPlat = this.getMostPopularOrFirst(platCounts, offer.options, CategorieItem.plat);
      const defaultAcc = this.getMostPopularOrFirst(accCounts, offer.options, CategorieItem.accompagnement);
      const defaultViande = this.getMostPopularOrFirst(viandeCounts, offer.options, CategorieItem.viande);

      // 4. Créer les commandes par défaut
      for (const sub of missingSubscriptions) {
        await prisma.order.create({
          data: {
            dailyOfferId,
            subscriptionId: sub.id,
            platId: defaultPlat,
            accompagnementId: defaultAcc,
            viandeId: defaultViande,
            statut: StatutCommande.verrouillee,
            estDefaut: true,
            prepare: false,
          },
        });
      }
    }

    // 5. Verrouiller toutes les commandes existantes
    await prisma.order.updateMany({
      where: { dailyOfferId, statut: StatutCommande.en_attente },
      data: { statut: StatutCommande.verrouillee },
    });

    // 6. Passer l'offre en verrouillé
    await prisma.dailyOffer.update({
      where: { id: dailyOfferId },
      data: { statut: StatutOffre.verrouille },
    });
  }

  /**
   * Résumé en direct des commandes pour le dashboard admin (SPEC 6).
   */
  async getLivePreparationSummary(dateStr?: string): Promise<LivePreparationSummary> {
    const targetDate = dateStr ?? getTodayDateString();
    const dateObj = dayjs(targetDate).toDate();

    const offer = await prisma.dailyOffer.findUnique({
      where: { date: dateObj },
      include: {
        options: { include: { catalogItem: true } },
        orders: {
          where: { statut: { not: StatutCommande.annulee } },
          include: {
            subscription: { include: { user: true } },
            plat: { include: { catalogItem: true } },
            accompagnement: { include: { catalogItem: true } },
            viande: { include: { catalogItem: true } },
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundError(`Aucune offre trouvée pour le ${targetDate}`);
    }

    // Quantités par item
    const quantityMap = new Map<string, { categorie: string; nom: string; quantite: number }>();
    for (const order of offer.orders) {
      const platKey = `plat:${order.plat.catalogItem.nom}`;
      const accKey = `acc:${order.accompagnement.catalogItem.nom}`;

      const existing1 = quantityMap.get(platKey);
      quantityMap.set(platKey, {
        categorie: 'plat',
        nom: order.plat.catalogItem.nom,
        quantite: (existing1?.quantite ?? 0) + 1,
      });

      const existing2 = quantityMap.get(accKey);
      quantityMap.set(accKey, {
        categorie: 'accompagnement',
        nom: order.accompagnement.catalogItem.nom,
        quantite: (existing2?.quantite ?? 0) + 1,
      });

      if (order.viande) {
        const viandeKey = `viande:${order.viande.catalogItem.nom}`;
        const existing3 = quantityMap.get(viandeKey);
        quantityMap.set(viandeKey, {
          categorie: 'viande',
          nom: order.viande.catalogItem.nom,
          quantite: (existing3?.quantite ?? 0) + 1,
        });
      }
    }

    const activeCount = await prisma.subscription.count({
      where: { statut: StatutAbonnement.actif },
    });

    const commandesDetaillees: ClientOrderDetailRow[] = offer.orders.map((o) => ({
      orderId: o.id,
      clientNom: o.subscription.user.nom,
      clientPrenom: o.subscription.user.prenom,
      clientTelephone: o.subscription.user.telephone,
      platNom: o.plat.catalogItem.nom,
      accompagnementNom: o.accompagnement.catalogItem.nom,
      viandeNom: o.viande?.catalogItem.nom ?? null,
      estDefaut: o.estDefaut,
      prepare: o.prepare,
      statut: o.statut as unknown as OrderStatus,
    }));

    return {
      date: targetDate,
      statutOffre: offer.statut as unknown as DailyOfferStatus,
      totalClientsActifs: activeCount,
      totalLivraisonsPrevues: offer.orders.length,
      quantitesParItem: Array.from(quantityMap.values()) as LivePreparationSummary['quantitesParItem'],
      commandesDetaillees,
    };
  }

  /**
   * Mise à jour du statut "préparé" par l'admin (SPEC 6).
   */
  async updatePreparationStatus(orderId: number, prepare: boolean): Promise<void> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundError('Commande introuvable');
    }
    await prisma.order.update({
      where: { id: orderId },
      data: { prepare },
    });
  }

  /**
   * Retourne l'option la plus demandée pour une catégorie,
   * ou la première option de cette catégorie si aucune commande n'existe (SPEC 5.8).
   */
  private getMostPopularOrFirst(
    counts: Map<number, number>,
    options: { id: number; catalogItem: { categorie: CategorieItem } }[],
    categorie: CategorieItem
  ): number {
    const categoryOptions = options.filter((o) => o.catalogItem.categorie === categorie);
    if (categoryOptions.length === 0) {
      throw new Error(`Aucune option disponible pour la catégorie ${categorie}`);
    }

    if (counts.size === 0) {
      return categoryOptions[0].id;
    }

    let maxId = categoryOptions[0].id;
    let maxCount = 0;
    for (const opt of categoryOptions) {
      const count = counts.get(opt.id) ?? 0;
      if (count > maxCount) {
        maxCount = count;
        maxId = opt.id;
      }
    }
    return maxId;
  }
}

export const orderService = new OrderService();
