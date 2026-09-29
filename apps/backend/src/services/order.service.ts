/**
 * Service Métier : Commandes, annulations, verrouillage à 20h et suivi de préparation.
 * Conforme à SPEC.md (5.6, 5.7, 5.8, 6) et AG_RULES.md.
 */

import { CategorieItem, Prisma, StatutOffre, StatutCommande } from '@prisma/client';
import {
  SubmitOrderDto,
  ItemCategory,
  DailyOfferStatus,
  LivePreparationSummary,
  ClientOrderDetailRow,
  PendingClientRow,
  OrderStatus,
  isSubscriptionRunning,
} from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { ClientSubscriptionContext } from './subscription.service';
import { ForbiddenError, BadRequestError, NotFoundError } from '../utils/errors';
import {
  fromDbDate,
  getTodayDateString,
  isLockTimeReached,
  isMeatAllowed,
  toDbDate,
} from '../utils/time';
import { computeDefaultChoices, OfferOptionRef } from '../utils/defaultOrder';
import { toSharedFormule } from '../utils/mappers';

type OptionWithItem = Prisma.OfferOptionGetPayload<{ include: { catalogItem: true } }>;

export class OrderService {
  /**
   * Garde commune aux actions du client (commander, annuler) :
   * abonnement en cours, offre du jour uniquement, et avant le verrouillage de 20h.
   */
  private async loadOpenOfferForClient(
    context: ClientSubscriptionContext,
    dailyOfferId: number
  ): Promise<Prisma.DailyOfferGetPayload<{ include: { options: { include: { catalogItem: true } } } }>> {
    if (!isSubscriptionRunning(context.view.etat)) {
      throw new ForbiddenError(
        context.view.etat === 'expire'
          ? "Ton abonnement est terminé : contacte l'administratrice pour le renouveler."
          : "Ton abonnement n'a pas encore commencé."
      );
    }

    const offer = await prisma.dailyOffer.findUnique({
      where: { id: dailyOfferId },
      include: { options: { include: { catalogItem: true } } },
    });
    if (!offer) {
      throw new NotFoundError('Menu introuvable');
    }

    const offerDate = fromDbDate(offer.date);
    if (offerDate !== getTodayDateString()) {
      throw new ForbiddenError('Tu ne peux commander que pour le repas du jour.');
    }

    if (offer.statut === StatutOffre.verrouille || isLockTimeReached(offerDate)) {
      await this.ensureLocked(offerDate);
      throw new ForbiddenError('Le menu est verrouillé après 20h. Aucune modification possible.');
    }

    return offer;
  }

  private requireOption(
    options: OptionWithItem[],
    optionId: number,
    categorie: CategorieItem,
    label: string
  ): OptionWithItem {
    const option = options.find((o) => o.id === optionId);
    if (option?.catalogItem.categorie !== categorie) {
      throw new BadRequestError(`${label} choisi(e) ne fait pas partie du menu du jour.`);
    }
    return option;
  }

  /**
   * Prise de commande ou modification du choix par le client (SPEC 5.6).
   * Reprendre son repas après une annulation (avant 20h) est possible : la commande redevient « en attente ».
   */
  async submitOrder(
    context: ClientSubscriptionContext,
    dto: SubmitOrderDto
  ): Promise<{ orderId: number }> {
    const offer = await this.loadOpenOfferForClient(context, dto.dailyOfferId);
    const offerDate = fromDbDate(offer.date);

    this.requireOption(offer.options, dto.platOptionId, CategorieItem.plat, 'Le plat');
    this.requireOption(
      offer.options,
      dto.accompagnementOptionId,
      CategorieItem.accompagnement,
      "L'accompagnement"
    );

    const menuHasMeat = offer.options.some((o) => o.catalogItem.categorie === CategorieItem.viande);
    const meatIncluded = isMeatAllowed(context.view.formule, offerDate);

    let viandeId: number | null = null;
    if (meatIncluded && menuHasMeat) {
      if (!dto.viandeOptionId) {
        throw new BadRequestError('Choisis ta viande.');
      }
      viandeId = this.requireOption(
        offer.options,
        dto.viandeOptionId,
        CategorieItem.viande,
        'La viande'
      ).id;
    } else if (dto.viandeOptionId) {
      throw new BadRequestError("Ta formule n'inclut pas la viande aujourd'hui.");
    }

    const choices = {
      platId: dto.platOptionId,
      accompagnementId: dto.accompagnementOptionId,
      viandeId,
      statut: StatutCommande.en_attente,
      estDefaut: false,
      prepare: false,
    };

    const order = await prisma.order.upsert({
      where: {
        dailyOfferId_subscriptionId: {
          dailyOfferId: offer.id,
          subscriptionId: context.subscription.id,
        },
      },
      create: { dailyOfferId: offer.id, subscriptionId: context.subscription.id, ...choices },
      update: choices,
    });

    return { orderId: order.id };
  }

  /**
   * Annulation du repas du jour par le client (SPEC 5.7), avant 20h.
   * Elle est enregistrée même si le client n'avait rien confirmé : sans cela, l'attribution
   * automatique de 20h lui enverrait un repas par défaut qu'il a refusé. L'annulation est
   * idempotente et réversible tant que le menu n'est pas verrouillé.
   */
  async cancelOrder(context: ClientSubscriptionContext, dailyOfferId: number): Promise<void> {
    const offer = await this.loadOpenOfferForClient(context, dailyOfferId);

    await prisma.order.upsert({
      where: {
        dailyOfferId_subscriptionId: {
          dailyOfferId: offer.id,
          subscriptionId: context.subscription.id,
        },
      },
      create: {
        dailyOfferId: offer.id,
        subscriptionId: context.subscription.id,
        statut: StatutCommande.annulee,
      },
      update: { statut: StatutCommande.annulee, estDefaut: false, prepare: false },
    });
  }

  /**
   * Verrouille l'offre d'une date si l'heure est venue (20h00 le jour même, ou date passée).
   * Appelée à chaque lecture concernée et par la tâche planifiée : le verrouillage ne dépend donc
   * jamais d'une action manuelle. Sans effet si l'offre est déjà verrouillée.
   */
  async ensureLocked(dateIso: string): Promise<void> {
    if (!isLockTimeReached(dateIso)) {
      return;
    }
    const offer = await prisma.dailyOffer.findUnique({ where: { date: toDbDate(dateIso) } });
    if (offer && offer.statut === StatutOffre.ouvert) {
      await this.lockAndAssignDefaults(offer.id);
    }
  }

  /** Verrouille toutes les offres dont l'heure est venue (tâche planifiée, rattrapage après une panne) */
  async lockDueOffers(): Promise<number> {
    const openOffers = await prisma.dailyOffer.findMany({ where: { statut: StatutOffre.ouvert } });
    let locked = 0;
    for (const offer of openOffers) {
      if (isLockTimeReached(fromDbDate(offer.date))) {
        await this.lockAndAssignDefaults(offer.id);
        locked++;
      }
    }
    return locked;
  }

  /**
   * Verrouillage à 20h et attribution des commandes par défaut (SPEC 5.8).
   * Idempotent et sûr en cas d'appels simultanés : l'offre est « réservée » atomiquement en premier.
   *
   * Reçoivent une commande par défaut : les clients dont l'abonnement couvre ce jour et qui n'ont
   * ni commandé ni annulé. Les annulations sont donc respectées.
   */
  async lockAndAssignDefaults(dailyOfferId: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const offer = await tx.dailyOffer.findUnique({
        where: { id: dailyOfferId },
        include: { options: { include: { catalogItem: true } } },
      });
      if (!offer || offer.statut === StatutOffre.verrouille) {
        return;
      }

      const claimed = await tx.dailyOffer.updateMany({
        where: { id: dailyOfferId, statut: StatutOffre.ouvert },
        data: { statut: StatutOffre.verrouille },
      });
      if (claimed.count === 0) {
        return;
      }

      const offerDate = fromDbDate(offer.date);
      const existingOrders = await tx.order.findMany({ where: { dailyOfferId } });
      const answered = new Set(existingOrders.map((o) => o.subscriptionId));

      const coveringSubscriptions = await tx.subscription.findMany({
        where: {
          dateDebut: { lte: toDbDate(offerDate) },
          dateFin: { gte: toDbDate(offerDate) },
        },
      });
      const waiting = coveringSubscriptions.filter((s) => !answered.has(s.id));

      if (waiting.length > 0) {
        const optionRefs: OfferOptionRef[] = offer.options.map((o) => ({
          id: o.id,
          categorie: o.catalogItem.categorie as unknown as ItemCategory,
        }));
        const placed = existingOrders.filter((o) => o.statut !== StatutCommande.annulee);
        const defaults = computeDefaultChoices(optionRefs, placed);

        await tx.order.createMany({
          data: waiting.map((sub) => ({
            dailyOfferId,
            subscriptionId: sub.id,
            platId: defaults.platId,
            accompagnementId: defaults.accompagnementId,
            viandeId: isMeatAllowed(toSharedFormule(sub.formule), offerDate) ? defaults.viandeId : null,
            statut: StatutCommande.verrouillee,
            estDefaut: true,
          })),
        });
      }

      await tx.order.updateMany({
        where: { dailyOfferId, statut: StatutCommande.en_attente },
        data: { statut: StatutCommande.verrouillee },
      });
    });
  }

  /**
   * Résumé en direct des commandes pour l'écran « Suivi du jour » (SPEC 6).
   */
  async getLivePreparationSummary(dateStr?: string): Promise<LivePreparationSummary> {
    const targetDate = dateStr ?? getTodayDateString();
    await this.ensureLocked(targetDate);

    const offer = await prisma.dailyOffer.findUnique({
      where: { date: toDbDate(targetDate) },
      include: {
        orders: {
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
      throw new NotFoundError(`Aucun menu publié pour le ${targetDate}`);
    }

    const covering = await prisma.subscription.findMany({
      where: {
        dateDebut: { lte: toDbDate(targetDate) },
        dateFin: { gte: toDbDate(targetDate) },
      },
      include: { user: true },
    });

    const activeOrders = offer.orders.filter((o) => o.statut !== StatutCommande.annulee);
    const cancelledCount = offer.orders.length - activeOrders.length;
    const answered = new Set(offer.orders.map((o) => o.subscriptionId));

    const quantities = new Map<string, { categorie: ItemCategory; nom: string; quantite: number }>();
    const addQuantity = (categorie: ItemCategory, nom: string | undefined): void => {
      if (!nom) return;
      const key = `${categorie}:${nom}`;
      const current = quantities.get(key);
      quantities.set(key, { categorie, nom, quantite: (current?.quantite ?? 0) + 1 });
    };
    for (const order of activeOrders) {
      addQuantity(ItemCategory.PLAT, order.plat?.catalogItem.nom);
      addQuantity(ItemCategory.ACCOMPAGNEMENT, order.accompagnement?.catalogItem.nom);
      addQuantity(ItemCategory.VIANDE, order.viande?.catalogItem.nom);
    }

    const commandesDetaillees: ClientOrderDetailRow[] = activeOrders.map((o) => ({
      orderId: o.id,
      clientNom: o.subscription.user.nom,
      clientPrenom: o.subscription.user.prenom,
      clientTelephone: o.subscription.user.telephone,
      formule: toSharedFormule(o.subscription.formule),
      platNom: o.plat?.catalogItem.nom ?? '',
      accompagnementNom: o.accompagnement?.catalogItem.nom ?? '',
      viandeNom: o.viande?.catalogItem.nom ?? null,
      estDefaut: o.estDefaut,
      origine: o.estDefaut ? 'automatique' : 'choisi',
      prepare: o.prepare,
      statut: o.statut as unknown as OrderStatus,
    }));

    const clientsEnAttente: PendingClientRow[] = covering
      .filter((sub) => !answered.has(sub.id))
      .map((sub) => ({
        subscriptionId: sub.id,
        clientNom: sub.user.nom,
        clientPrenom: sub.user.prenom,
        formule: toSharedFormule(sub.formule),
      }));

    return {
      date: targetDate,
      statutOffre: offer.statut as unknown as DailyOfferStatus,
      heureLimiteIndicative: offer.heureLimiteIndicative,
      totalClientsActifs: covering.length,
      totalLivraisonsPrevues: covering.length - cancelledCount,
      totalPrepares: activeOrders.filter((o) => o.prepare).length,
      quantitesParItem: Array.from(quantities.values()).sort(
        (a, b) => a.categorie.localeCompare(b.categorie) || b.quantite - a.quantite
      ),
      commandesDetaillees,
      clientsEnAttente,
      clientsAnnules: cancelledCount,
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
    if (order.statut === StatutCommande.annulee) {
      throw new BadRequestError('Cette commande est annulée : rien à préparer.');
    }
    await prisma.order.update({
      where: { id: orderId },
      data: { prepare },
    });
  }
}

export const orderService = new OrderService();
