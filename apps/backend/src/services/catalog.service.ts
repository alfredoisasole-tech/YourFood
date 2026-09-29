/**
 * Service Métier : Catalogue de plats.
 * Conforme à SPEC.md (5.4) et AG_RULES.md.
 */

import { CatalogItem, CategorieItem, StatutOffre } from '@prisma/client';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { fromDbDate } from '../utils/time';
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

  /** Récupère tous les plats de la carte (y compris désactivés) pour l'admin */
  async getAll(): Promise<CatalogItem[]> {
    return prisma.catalogItem.findMany({
      where: { supprime: false },
      orderBy: [{ categorie: 'asc' }, { actif: 'desc' }, { nom: 'asc' }],
    });
  }

  /** Ajoute un nouveau plat au catalogue */
  async create(dto: CreateCatalogItemDto): Promise<CatalogItem> {
    return prisma.catalogItem.create({
      data: {
        categorie: dto.categorie as CategorieItem,
        nom: dto.nom.trim(),
        actif: dto.actif ?? true,
      },
    });
  }

  /**
   * Met à jour un plat existant (nom, catégorie ou statut actif/inactif).
   * La catégorie ne peut plus changer une fois le plat proposé sur un menu : cela fausserait l'historique.
   */
  async update(id: number, dto: UpdateCatalogItemDto): Promise<CatalogItem> {
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

    return prisma.catalogItem.update({
      where: { id },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom.trim() } : {}),
        ...(dto.categorie !== undefined ? { categorie: dto.categorie as CategorieItem } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
    });
  }

  /**
   * Supprime un plat du catalogue (SPEC 5.4).
   * - Proposé sur un menu non verrouillé : refusé, en indiquant le jour, et l'admin est invitée à le désactiver ;
   * - déjà servi sur des jours passés : retiré de la carte mais conservé en base (suppression douce),
   *   pour que l'historique et les avis des clients restent intacts ;
   * - jamais utilisé : supprimé pour de bon.
   */
  async delete(id: number): Promise<void> {
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
      return;
    }

    await prisma.catalogItem.delete({ where: { id } });
  }
}

export const catalogService = new CatalogService();
