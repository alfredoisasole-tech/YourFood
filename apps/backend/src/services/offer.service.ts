/**
 * Service Métier : Publication et consultation des offres du jour.
 * Conforme à SPEC.md (5.5, 5.6) et AG_RULES.md.
 */

import {
  PublishSingleOfferDto,
  PublishMultiDaysOfferDto,
  ClientDailyMenuView,
  CatalogItemWithOptionId,
  ItemCategory,
  DailyOfferStatus,
  SubscriptionPlan,
  OrderStatus,
} from '@meal-app/shared';
import { CategorieItem, StatutOffre } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { getWorkingDays, getOfferTimeStatus, isMeatAllowed, getTodayDateString } from '../utils/time';
import { BadRequestError, NotFoundError } from '../utils/errors';
import dayjs from 'dayjs';

export class OfferService {
  /**
   * Publication d'un menu pour un jour unique (SPEC 5.5).
   * Exactement 6 items du catalogue requis : 2 plats, 2 accompagnements, 2 viandes.
   */
  async publishSingle(dto: PublishSingleOfferDto): Promise<{ id: number; date: string }> {
    await this.validateCatalogItems(dto.catalogItemIds);

    const existing = await prisma.dailyOffer.findUnique({
      where: { date: dayjs(dto.date).toDate() },
    });

    if (existing) {
      throw new BadRequestError(`Une offre existe déjà pour le ${dto.date}`);
    }

    const offer = await prisma.dailyOffer.create({
      data: {
        date: dayjs(dto.date).toDate(),
        heureLimiteIndicative: dto.heureLimiteIndicative ?? '13:00',
        statut: StatutOffre.ouvert,
        options: {
          create: dto.catalogItemIds.map((catalogItemId) => ({
            catalogItemId,
          })),
        },
      },
    });

    return { id: offer.id, date: dto.date };
  }

  /**
   * Publication multi-jours (SPEC 5.5) : duplique le même menu sur N jours ouvrés.
   */
  async publishMultiDays(dto: PublishMultiDaysOfferDto): Promise<{ dates: string[] }> {
    await this.validateCatalogItems(dto.catalogItemIds);

    const workingDays = getWorkingDays(dto.dateDebut, dto.nombreJours);
    const createdDates: string[] = [];

    for (const dateStr of workingDays) {
      const dateObj = dayjs(dateStr).toDate();
      const existing = await prisma.dailyOffer.findUnique({ where: { date: dateObj } });

      if (!existing) {
        await prisma.dailyOffer.create({
          data: {
            date: dateObj,
            heureLimiteIndicative: dto.heureLimiteIndicative ?? '13:00',
            statut: StatutOffre.ouvert,
            options: {
              create: dto.catalogItemIds.map((catalogItemId) => ({
                catalogItemId,
              })),
            },
          },
        });
        createdDates.push(dateStr);
      }
    }

    return { dates: createdDates };
  }

  /**
   * Menu du jour vu par le client (SPEC 5.6 & 7).
   */
  async getClientDailyMenu(
    subscriptionId: number,
    formule: SubscriptionPlan | string
  ): Promise<ClientDailyMenuView> {
    const todayStr = getTodayDateString();
    const todayDate = dayjs(todayStr).toDate();

    const offer = await prisma.dailyOffer.findUnique({
      where: { date: todayDate },
      include: {
        options: {
          include: { catalogItem: true },
        },
      },
    });

    if (!offer) {
      throw new NotFoundError('Aucune offre publiée pour aujourd\'hui');
    }

    // Grouper les options par catégorie
    const plats: CatalogItemWithOptionId[] = [];
    const accompagnements: CatalogItemWithOptionId[] = [];
    const viandes: CatalogItemWithOptionId[] = [];

    for (const opt of offer.options) {
      const mapped: CatalogItemWithOptionId = {
        optionId: opt.id,
        catalogItemId: opt.catalogItem.id,
        nom: opt.catalogItem.nom,
        categorie: opt.catalogItem.categorie as unknown as ItemCategory,
      };

      switch (opt.catalogItem.categorie) {
        case CategorieItem.plat:
          plats.push(mapped);
          break;
        case CategorieItem.accompagnement:
          accompagnements.push(mapped);
          break;
        case CategorieItem.viande:
          viandes.push(mapped);
          break;
      }
    }

    const estViandeAutorisee = isMeatAllowed(formule, todayStr);
    const statutMenu = getOfferTimeStatus(offer.heureLimiteIndicative);

    // Commande existante du client pour aujourd'hui
    const existingOrder = await prisma.order.findFirst({
      where: {
        dailyOfferId: offer.id,
        subscriptionId,
      },
      include: {
        plat: { include: { catalogItem: true } },
        accompagnement: { include: { catalogItem: true } },
        viande: { include: { catalogItem: true } },
      },
    });

    // Avis du repas de la veille à remplir (SPEC 5.9)
    const yesterday = dayjs(todayStr).subtract(1, 'day').toDate();
    const yesterdayOffer = await prisma.dailyOffer.findUnique({
      where: { date: yesterday },
    });

    let avisRepasPrecedent = null;
    if (yesterdayOffer) {
      const yesterdayOrder = await prisma.order.findFirst({
        where: {
          dailyOfferId: yesterdayOffer.id,
          subscriptionId,
          statut: { not: 'annulee' },
        },
        include: { review: true },
      });

      if (yesterdayOrder && (!yesterdayOrder.review || !yesterdayOrder.review.rempli)) {
        avisRepasPrecedent = {
          orderId: yesterdayOrder.id,
          date: dayjs(yesterday).format('YYYY-MM-DD'),
        };
      }
    }

    return {
      dailyOffer: {
        id: offer.id,
        date: todayStr,
        heureLimiteIndicative: offer.heureLimiteIndicative,
        statut: offer.statut as unknown as DailyOfferStatus,
      },
      optionsParCategorie: {
        plats,
        accompagnements,
        viandes,
      },
      estViandeAutoriseeAujourdhui: estViandeAutorisee,
      statutMenu,
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
      avisRepasPrecedentACompleter: avisRepasPrecedent,
    };
  }

  /**
   * Valide que les 6 IDs du catalogue respectent la contrainte : 2 par catégorie.
   */
  private async validateCatalogItems(ids: number[]): Promise<void> {
    const items = await prisma.catalogItem.findMany({
      where: { id: { in: ids }, actif: true },
    });

    if (items.length !== 6) {
      throw new BadRequestError(
        `${items.length} items trouvés sur 6 attendus. Vérifiez que tous les items existent et sont actifs.`
      );
    }

    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.categorie] = (counts[item.categorie] ?? 0) + 1;
    }

    if (counts['plat'] !== 2 || counts['accompagnement'] !== 2 || counts['viande'] !== 2) {
      throw new BadRequestError(
        'L\'offre doit contenir exactement 2 plats, 2 accompagnements et 2 viandes.'
      );
    }
  }
}

export const offerService = new OfferService();
