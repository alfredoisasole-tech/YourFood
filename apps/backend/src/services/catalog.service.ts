/**
 * Service Métier : Catalogue de plats.
 * Conforme à SPEC.md (5.4) et AG_RULES.md.
 */

import { CatalogItem, CategorieItem, StatutCommande, StatutOffre } from '@prisma/client';
import {
  CatalogItemView,
  CreateCatalogItemDto,
  ItemCategory,
  UpdateCatalogItemDto,
  UpdateCatalogItemResponse,
} from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { fromDbDate, getTodayDateString, toDbDate } from '../utils/time';
import { formatDateFr } from '../utils/whatsapp';
import { NotFoundError, ConflictError } from '../utils/errors';

export class CatalogService {
  /** Récupère tous les plats actifs (non supprimés), regroupés par catégorie */
  async getAllActive(): Promise<CatalogItem[]> {
    return prisma.catalogItem.findMany({
      where: { actif: true, supprime: false },
      orderBy: [{ categorie: 'asc' }, { nom: 'asc' }],
    });
  }

  /** Tous les plats de la carte (y compris désactivés), avec les menus non verrouillés qui les proposent */
  async getAll(): Promise<CatalogItemView[]> {
    const items = await prisma.catalogItem.findMany({
      where: { supprime: false },
      include: {
        offerOptions: {
          where: { dailyOffer: { statut: StatutOffre.ouvert } },
          select: { dailyOffer: { select: { date: true } } },
        },
      },
      orderBy: [{ categorie: 'asc' }, { actif: 'desc' }, { nom: 'asc' }],
    });
    return items.map(({ offerOptions, ...item }) =>
      this.toView(item, offerOptions.map((o) => fromDbDate(o.dailyOffer.date)))
    );
  }

  private toView(item: CatalogItem, prochainsMenus: string[]): CatalogItemView {
    return {
      id: item.id,
      categorie: item.categorie as unknown as ItemCategory,
      nom: item.nom,
      actif: item.actif,
      createdAt: item.createdAt.toISOString(),
      prochainsMenus: [...prochainsMenus].sort(),
    };
  }

  private async openMenuDates(id: number): Promise<string[]> {
    const options = await prisma.offerOption.findMany({
      where: { catalogItemId: id, dailyOffer: { statut: StatutOffre.ouvert } },
      select: { dailyOffer: { select: { date: true } } },
    });
    return options.map((o) => fromDbDate(o.dailyOffer.date));
  }

  /** Ajoute un nouveau plat au catalogue */
  async create(dto: CreateCatalogItemDto): Promise<CatalogItemView> {
    const item = await prisma.catalogItem.create({
      data: {
        categorie: dto.categorie as CategorieItem,
        nom: dto.nom.trim(),
        actif: dto.actif ?? true,
      },
    });
    return this.toView(item, []);
  }

  /**
   * Met à jour un plat existant (nom, catégorie ou statut actif/inactif).
   * - La catégorie ne peut plus changer une fois le plat proposé sur un menu : cela fausserait l'historique.
   * - Un plat désactivé « disparaît des prochains menus » (maquette) : il est retiré des menus à venir.
   */
  async update(id: number, dto: UpdateCatalogItemDto): Promise<UpdateCatalogItemResponse> {
    const item = await prisma.catalogItem.findFirst({ where: { id, supprime: false } });
    if (!item) {
      throw new NotFoundError('Plat introuvable dans le catalogue');
    }

    if (dto.categorie && dto.categorie !== (item.categorie as string)) {
      const usedOnMenu = await prisma.offerOption.findFirst({ where: { catalogItemId: id } });
      if (usedOnMenu) {
        throw new ConflictError(
          'Ce plat a déjà été proposé sur un menu : on ne peut plus changer sa catégorie. Crée plutôt un nouveau plat.'
        );
      }
    }

    const updated = await prisma.catalogItem.update({
      where: { id },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom.trim() } : {}),
        ...(dto.categorie !== undefined ? { categorie: dto.categorie as CategorieItem } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
    });

    const removal =
      dto.actif === false && item.actif
        ? await this.removeFromUpcomingMenus(updated)
        : { menusRetires: [], menusConserves: [] };

    return {
      item: this.toView(updated, await this.openMenuDates(id)),
      ...removal,
    };
  }

  /**
   * Retire un plat désactivé des menus à venir (à partir de demain : le menu du jour est déjà
   * affiché aux clients). Il est conservé sur un menu si un client l'a déjà choisi, ou s'il y est
   * la seule option de sa catégorie (un menu doit garder au moins une option par catégorie).
   */
  private async removeFromUpcomingMenus(
    item: CatalogItem
  ): Promise<{ menusRetires: string[]; menusConserves: string[] }> {
    const today = getTodayDateString();
    const options = await prisma.offerOption.findMany({
      where: {
        catalogItemId: item.id,
        dailyOffer: { statut: StatutOffre.ouvert, date: { gt: toDbDate(today) } },
      },
      include: {
        dailyOffer: {
          include: { options: { include: { catalogItem: { select: { categorie: true } } } } },
        },
      },
    });

    const menusRetires: string[] = [];
    const menusConserves: string[] = [];

    for (const option of options) {
      const date = fromDbDate(option.dailyOffer.date);
      const sameCategory = option.dailyOffer.options.filter(
        (o) => o.catalogItem.categorie === item.categorie
      );
      const chosen = await prisma.order.count({
        where: {
          statut: { not: StatutCommande.annulee },
          OR: [{ platId: option.id }, { accompagnementId: option.id }, { viandeId: option.id }],
        },
      });

      if (chosen > 0 || sameCategory.length <= 1) {
        menusConserves.push(date);
        continue;
      }
      await prisma.offerOption.delete({ where: { id: option.id } });
      menusRetires.push(date);
    }

    return { menusRetires: menusRetires.sort(), menusConserves: menusConserves.sort() };
  }

  /**
   * Supprime un plat du catalogue (SPEC 5.4).
   * - Proposé sur un menu non verrouillé : refusé, en indiquant le jour, et l'admin est invitée à le désactiver ;
   * - déjà servi sur des jours passés : retiré de la carte mais conservé en base (suppression douce),
   *   pour que l'historique et les avis des clients restent intacts ;
   * - jamais utilisé : supprimé pour de bon.
   */
  async delete(id: number): Promise<{ restants: number }> {
    const item = await prisma.catalogItem.findFirst({ where: { id, supprime: false } });
    if (!item) {
      throw new NotFoundError('Plat introuvable dans le catalogue');
    }

    const openOffer = await prisma.offerOption.findFirst({
      where: { catalogItemId: id, dailyOffer: { statut: StatutOffre.ouvert } },
      include: { dailyOffer: true },
      orderBy: { dailyOffer: { date: 'asc' } },
    });

    if (openOffer) {
      const date = fromDbDate(openOffer.dailyOffer.date);
      throw new ConflictError(
        `« ${item.nom} » est proposé sur le menu du ${formatDateFr(date)}, qui n'est pas encore verrouillé. ` +
          'Désactive-le plutôt : il disparaîtra des prochains menus, sans être perdu.',
        { code: 'PLAT_SUR_MENU_OUVERT', date }
      );
    }

    const everServed = await prisma.offerOption.findFirst({ where: { catalogItemId: id } });
    if (everServed) {
      await prisma.catalogItem.update({ where: { id }, data: { supprime: true, actif: false } });
    } else {
      await prisma.catalogItem.delete({ where: { id } });
    }

    return { restants: await prisma.catalogItem.count({ where: { supprime: false } }) };
  }
}

export const catalogService = new CatalogService();
