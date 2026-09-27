/**
 * Service Métier : Catalogue de plats.
 * Conforme à SPEC.md (5.4) et AG_RULES.md.
 */

import { CatalogItem, CategorieItem } from '@prisma/client';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';

export class CatalogService {
  /** Récupère tous les plats actifs, regroupés par catégorie */
  async getAllActive(): Promise<CatalogItem[]> {
    return prisma.catalogItem.findMany({
      where: { actif: true },
      orderBy: [{ categorie: 'asc' }, { nom: 'asc' }],
    });
  }

  /** Récupère tous les plats (y compris désactivés) pour l'admin */
  async getAll(): Promise<CatalogItem[]> {
    return prisma.catalogItem.findMany({
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

  /** Met à jour un plat existant (nom ou statut actif/inactif) */
  async update(id: number, dto: UpdateCatalogItemDto): Promise<CatalogItem> {
    const item = await prisma.catalogItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundError('Plat introuvable dans le catalogue');
    }

    return prisma.catalogItem.update({
      where: { id },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom.trim() } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
    });
  }

  /**
   * Supprime un plat du catalogue.
   * SPEC 5.4 : un plat ne peut pas être supprimé s'il est utilisé sur une offre non verrouillée.
   */
  async delete(id: number): Promise<void> {
    const item = await prisma.catalogItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundError('Plat introuvable dans le catalogue');
    }

    // Vérifier s'il est utilisé dans une offre non verrouillée
    const usedInOpenOffer = await prisma.offerOption.findFirst({
      where: {
        catalogItemId: id,
        dailyOffer: { statut: 'ouvert' },
      },
    });

    if (usedInOpenOffer) {
      throw new ConflictError(
        'Ce plat ne peut pas être supprimé car il est utilisé dans une offre en cours. Désactivez-le à la place.'
      );
    }

    await prisma.catalogItem.delete({ where: { id } });
  }
}

export const catalogService = new CatalogService();
