/**
 * Service Métier : Publication et consultation des offres du jour.
 * Conforme à SPEC.md (5.5, 5.6) et AG_RULES.md.
 *
 * Un menu compte au moins un plat, un accompagnement et une viande, sans maximum imposé par catégorie.
 */

import { CatalogItem, CategorieItem, Prisma, StatutCommande, StatutOffre } from '@prisma/client';
import {
  PublishSingleOfferDto,
  PublishMultiDaysOfferDto,
  UpdateOfferDto,
  ClientDailyMenuView,
  CatalogItemWithOptionId,
  AdminOfferView,
  WeekDayView,
  ItemCategory,
  DailyOfferStatus,
  LOCK_TIME,
  OrderStatus,
  addDays,
  isWeekday,
  previousWorkingDay,
} from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { ClientSubscriptionContext } from './subscription.service';
import { orderService } from './order.service';
import {
  fromDbDate,
  getOfferTimeStatus,
  getTodayDateString,
  getWorkingDays,
  isLockTimeReached,
  isMeatAllowed,
  toDbDate,
  nowKinshasa,
} from '../utils/time';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';

type OfferWithOptions = Prisma.DailyOfferGetPayload<{
  include: { options: { include: { catalogItem: true } } };
}>;

const EMPTY_OPTIONS: ClientDailyMenuView['optionsParCategorie'] = {
  plats: [],
  accompagnements: [],
  viandes: [],
};

export class OfferService {
  /**
   * Vérifie que les plats existent, sont proposés (actifs, non supprimés) et couvrent
   * les trois catégories.
   */
  private async validateCatalogItems(ids: number[]): Promise<CatalogItem[]> {
    const items = await prisma.catalogItem.findMany({
      where: { id: { in: ids }, actif: true, supprime: false },
    });

    if (items.length !== ids.length) {
      throw new BadRequestError(
        'Un ou plusieurs plats sont introuvables ou désactivés. Vérifie ta carte.'
      );
    }

    for (const categorie of [CategorieItem.plat, CategorieItem.accompagnement, CategorieItem.viande]) {
      if (!items.some((item) => item.categorie === categorie)) {
        throw new BadRequestError(
          'Un menu doit contenir au moins un plat, un accompagnement et une viande.'
        );
      }
    }
    return items;
  }

  private assertPublishable(dateIso: string): void {
    if (dateIso < getTodayDateString() || isLockTimeReached(dateIso)) {
      throw new BadRequestError('On ne peut plus publier de menu pour ce jour : il est trop tard.');
    }
  }

  private async createOffer(
    dateIso: string,
    heureLimiteIndicative: string,
    catalogItemIds: number[]
  ): Promise<{ id: number }> {
    return prisma.dailyOffer.create({
      data: {
        date: toDbDate(dateIso),
        heureLimiteIndicative,
        statut: StatutOffre.ouvert,
        options: { create: catalogItemIds.map((catalogItemId) => ({ catalogItemId })) },
      },
      select: { id: true },
    });
  }

  /** Publication d'un menu pour un jour unique (SPEC 5.5) */
  async publishSingle(dto: PublishSingleOfferDto): Promise<{ id: number; date: string }> {
    this.assertPublishable(dto.date);
    await this.validateCatalogItems(dto.catalogItemIds);

    const existing = await prisma.dailyOffer.findUnique({ where: { date: toDbDate(dto.date) } });
    if (existing) {
      throw new ConflictError(`Un menu est déjà publié pour le ${dto.date} : modifie-le plutôt.`);
    }

    const offer = await this.createOffer(
      dto.date,
      dto.heureLimiteIndicative ?? '13:00',
      dto.catalogItemIds
    );
    return { id: offer.id, date: dto.date };
  }

  /**
   * Publication multi-jours (SPEC 5.5) : duplique le même menu sur N jours ouvrés.
   * Chaque jour reste ensuite modifiable individuellement. Les jours qui ont déjà un menu sont ignorés.
   */
  async publishMultiDays(
    dto: PublishMultiDaysOfferDto
  ): Promise<{ dates: string[]; ignores: string[] }> {
    this.assertPublishable(dto.dateDebut);
    await this.validateCatalogItems(dto.catalogItemIds);

    const created: string[] = [];
    const ignored: string[] = [];

    for (const dateIso of getWorkingDays(dto.dateDebut, dto.nombreJours)) {
      const existing = await prisma.dailyOffer.findUnique({ where: { date: toDbDate(dateIso) } });
      if (existing) {
        ignored.push(dateIso);
        continue;
      }
      await this.createOffer(dateIso, dto.heureLimiteIndicative ?? '13:00', dto.catalogItemIds);
      created.push(dateIso);
    }

    return { dates: created, ignores: ignored };
  }

  /**
   * Modification d'un menu à venir (heure limite et/ou plats).
   * Un plat déjà choisi par un client ne peut pas être retiré du menu.
   */
  async updateOffer(dateIso: string, dto: UpdateOfferDto): Promise<AdminOfferView> {
    const offer = await prisma.dailyOffer.findUnique({
      where: { date: toDbDate(dateIso) },
      include: { options: true },
    });
    if (!offer) {
      throw new NotFoundError('Aucun menu publié pour ce jour');
    }
    if (offer.statut === StatutOffre.verrouille || isLockTimeReached(dateIso)) {
      throw new ForbiddenError('Ce menu est verrouillé : il ne peut plus être modifié.');
    }

    if (dto.catalogItemIds) {
      await this.validateCatalogItems(dto.catalogItemIds);
      const wanted = new Set(dto.catalogItemIds);
      const toRemove = offer.options.filter((o) => !wanted.has(o.catalogItemId));
      const existingItemIds = new Set(offer.options.map((o) => o.catalogItemId));
      const toAdd = dto.catalogItemIds.filter((id) => !existingItemIds.has(id));

      if (toRemove.length > 0) {
        const removedIds = toRemove.map((o) => o.id);
        const chosen = await prisma.order.count({
          where: {
            dailyOfferId: offer.id,
            statut: { not: StatutCommande.annulee },
            OR: [
              { platId: { in: removedIds } },
              { accompagnementId: { in: removedIds } },
              { viandeId: { in: removedIds } },
            ],
          },
        });
        if (chosen > 0) {
          throw new ConflictError(
            'Des clients ont déjà choisi un des plats que tu retires. Garde-le sur le menu.'
          );
        }
      }

      await prisma.$transaction([
        prisma.offerOption.deleteMany({ where: { id: { in: toRemove.map((o) => o.id) } } }),
        prisma.offerOption.createMany({
          data: toAdd.map((catalogItemId) => ({ dailyOfferId: offer.id, catalogItemId })),
        }),
      ]);
    }

    if (dto.heureLimiteIndicative) {
      await prisma.dailyOffer.update({
        where: { id: offer.id },
        data: { heureLimiteIndicative: dto.heureLimiteIndicative },
      });
    }

    const [view] = await this.buildAdminViews([dateIso]);
    if (!view) {
      throw new NotFoundError('Aucun menu publié pour ce jour');
    }
    return view;
  }

  /**
   * Jours ouvrés d'une plage, publiés ou non, avec les livraisons attendues.
   * Alimente le bandeau de la semaine (Accueil) et la liste « Menus à venir ».
   */
  async listWeek(from: string, to: string): Promise<WeekDayView[]> {
    const dates: string[] = [];
    for (let current = from; current <= to && dates.length < 62; current = addDays(current, 1)) {
      if (isWeekday(current)) {
        dates.push(current);
      }
    }

    const views = await this.buildAdminViews(dates);
    const byDate = new Map(views.map((view) => [view.date, view]));
    const covering = await this.countCoveringSubscriptions(dates);

    return dates.map((date) => ({
      date,
      publie: byDate.has(date),
      offre: byDate.get(date) ?? null,
      livraisonsPrevues: byDate.get(date)?.livraisonsPrevues ?? covering.get(date) ?? 0,
    }));
  }

  /** Abonnements couvrant chaque date (une requête pour toute la plage) */
  private async countCoveringSubscriptions(dates: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const first = dates[0];
    const last = dates[dates.length - 1];
    if (!first || !last) {
      return counts;
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { dateDebut: { lte: toDbDate(last) }, dateFin: { gte: toDbDate(first) } },
      select: { dateDebut: true, dateFin: true },
    });

    for (const date of dates) {
      counts.set(
        date,
        subscriptions.filter((s) => fromDbDate(s.dateDebut) <= date && fromDbDate(s.dateFin) >= date)
          .length
      );
    }
    return counts;
  }

  private async buildAdminViews(dates: string[]): Promise<AdminOfferView[]> {
    if (dates.length === 0) {
      return [];
    }

    const offers = await prisma.dailyOffer.findMany({
      where: { date: { in: dates.map(toDbDate) } },
      include: {
        options: { include: { catalogItem: true } },
        orders: { select: { statut: true } },
      },
      orderBy: { date: 'asc' },
    });
    const covering = await this.countCoveringSubscriptions(dates);

    return offers.map((offer) => {
      const date = fromDbDate(offer.date);
      const cancelled = offer.orders.filter((o) => o.statut === StatutCommande.annulee).length;
      const grouped = this.groupOptions(offer.options);

      return {
        id: offer.id,
        date,
        statut: offer.statut as unknown as DailyOfferStatus,
        heureLimiteIndicative: offer.heureLimiteIndicative,
        plats: grouped.plats,
        accompagnements: grouped.accompagnements,
        viandes: grouped.viandes,
        livraisonsPrevues: (covering.get(date) ?? 0) - cancelled,
        commandesRecues: offer.orders.length - cancelled,
      };
    });
  }

  private groupOptions(
    options: OfferWithOptions['options']
  ): ClientDailyMenuView['optionsParCategorie'] {
    const grouped: ClientDailyMenuView['optionsParCategorie'] = {
      plats: [],
      accompagnements: [],
      viandes: [],
    };

    for (const opt of [...options].sort((a, b) => a.id - b.id)) {
      const mapped: CatalogItemWithOptionId = {
        optionId: opt.id,
        catalogItemId: opt.catalogItem.id,
        nom: opt.catalogItem.nom,
        categorie: opt.catalogItem.categorie as unknown as ItemCategory,
      };
      switch (opt.catalogItem.categorie) {
        case CategorieItem.plat:
          grouped.plats.push(mapped);
          break;
        case CategorieItem.accompagnement:
          grouped.accompagnements.push(mapped);
          break;
        case CategorieItem.viande:
          grouped.viandes.push(mapped);
          break;
      }
    }
    return grouped;
  }

  /**
   * Menu du jour vu par le client (SPEC 5.6 & 7).
   * Toujours une réponse exploitable : sans menu publié, `statutMenu` vaut « aucun_menu ».
   * Un abonnement expiré reçoit la même vue, à afficher grisée (SPEC 5.11).
   */
  async getClientDailyMenu(context: ClientSubscriptionContext): Promise<ClientDailyMenuView> {
    const todayStr = getTodayDateString();
    await orderService.ensureLocked(todayStr);

    const base = {
      date: todayStr,
      formule: context.view.formule,
      etatAbonnement: context.view.etat,
      dateFinAbonnement: context.view.dateFin,
      estViandeAutoriseeAujourdhui: isMeatAllowed(context.view.formule, todayStr),
      heureVerrouillage: LOCK_TIME,
      serverNow: nowKinshasa().toISOString(),
    };

    const offer = await prisma.dailyOffer.findUnique({
      where: { date: toDbDate(todayStr) },
      include: { options: { include: { catalogItem: true } } },
    });

    const avisRepasPrecedentACompleter = await this.findMealToReview(context.subscription.userId, todayStr);

    if (!offer) {
      return {
        ...base,
        dailyOffer: null,
        optionsParCategorie: EMPTY_OPTIONS,
        statutMenu: 'aucun_menu',
        commandeExistante: null,
        avisRepasPrecedentACompleter,
      };
    }

    const existingOrder = await prisma.order.findUnique({
      where: {
        dailyOfferId_subscriptionId: { dailyOfferId: offer.id, subscriptionId: context.subscription.id },
      },
    });

    return {
      ...base,
      dailyOffer: {
        id: offer.id,
        date: todayStr,
        heureLimiteIndicative: offer.heureLimiteIndicative,
        statut: offer.statut as unknown as DailyOfferStatus,
      },
      optionsParCategorie: this.groupOptions(offer.options),
      statutMenu: offer.statut === StatutOffre.verrouille ? 'verrouille' : getOfferTimeStatus(offer.heureLimiteIndicative),
      commandeExistante: existingOrder
        ? {
            id: existingOrder.id,
            dailyOfferId: existingOrder.dailyOfferId,
            subscriptionId: existingOrder.subscriptionId,
            platId: existingOrder.platId,
            accompagnementId: existingOrder.accompagnementId,
            viandeId: existingOrder.viandeId,
            statut: existingOrder.statut as unknown as OrderStatus,
            estDefaut: existingOrder.estDefaut,
            prepare: existingOrder.prepare,
            createdAt: existingOrder.createdAt.toISOString(),
            updatedAt: existingOrder.updatedAt.toISOString(),
          }
        : null,
      avisRepasPrecedentACompleter,
    };
  }

  /**
   * Repas du dernier jour ouvré (le lundi : celui du vendredi), proposé avec le menu suivant
   * pour un avis facultatif (SPEC 5.9). Les commandes annulées n'ont rien à noter.
   */
  private async findMealToReview(
    userId: number,
    todayStr: string
  ): Promise<{ orderId: number; date: string } | null> {
    const previousDay = previousWorkingDay(todayStr);
    const order = await prisma.order.findFirst({
      where: {
        subscription: { userId },
        dailyOffer: { date: toDbDate(previousDay) },
        statut: { not: StatutCommande.annulee },
      },
      include: { review: true },
    });

    if (!order || order.review?.rempli) {
      return null;
    }
    return { orderId: order.id, date: previousDay };
  }
}

export const offerService = new OfferService();
