import { describe, it, expect } from 'vitest';
import { ItemCategory } from '@meal-app/shared';
import { computeDefaultChoices, pickMostRequested, OfferOptionRef } from '../../src/utils/defaultOrder';

const options: OfferOptionRef[] = [
  { id: 1, categorie: ItemCategory.PLAT },
  { id: 2, categorie: ItemCategory.PLAT },
  { id: 3, categorie: ItemCategory.ACCOMPAGNEMENT },
  { id: 4, categorie: ItemCategory.ACCOMPAGNEMENT },
  { id: 5, categorie: ItemCategory.VIANDE },
  { id: 6, categorie: ItemCategory.VIANDE },
];

describe('Commande par défaut (SPEC 5.8)', () => {
  it('prend la première option de chaque catégorie quand personne n\'a commandé', () => {
    expect(computeDefaultChoices(options, [])).toEqual({ platId: 1, accompagnementId: 3, viandeId: 5 });
  });

  it('prend l\'option la plus demandée, catégorie par catégorie', () => {
    const placed = [
      { platId: 2, accompagnementId: 3, viandeId: 6 },
      { platId: 2, accompagnementId: 4, viandeId: 6 },
      { platId: 1, accompagnementId: 4, viandeId: 5 },
      { platId: 2, accompagnementId: 4, viandeId: null },
    ];
    expect(computeDefaultChoices(options, placed)).toEqual({ platId: 2, accompagnementId: 4, viandeId: 6 });
  });

  it('départage une égalité par la première option du menu', () => {
    const placed = [
      { platId: 2, accompagnementId: 4, viandeId: 6 },
      { platId: 1, accompagnementId: 3, viandeId: 5 },
    ];
    expect(computeDefaultChoices(options, placed)).toEqual({ platId: 1, accompagnementId: 3, viandeId: 5 });
  });

  it('ignore les commandes sans choix (annulations)', () => {
    const placed = [
      { platId: null, accompagnementId: null, viandeId: null },
      { platId: null, accompagnementId: null, viandeId: null },
      { platId: 2, accompagnementId: 4, viandeId: 6 },
    ];
    expect(computeDefaultChoices(options, placed)).toEqual({ platId: 2, accompagnementId: 4, viandeId: 6 });
  });

  it('ne propose pas de viande si le menu n\'en a pas', () => {
    const sansViande = options.filter((o) => o.categorie !== ItemCategory.VIANDE);
    expect(computeDefaultChoices(sansViande, []).viandeId).toBeNull();
  });

  it('refuse un menu sans plat ou sans accompagnement', () => {
    expect(() => computeDefaultChoices(options.filter((o) => o.categorie !== ItemCategory.PLAT), [])).toThrow();
  });

  it('pickMostRequested renvoie null pour une catégorie absente', () => {
    expect(pickMostRequested([], ItemCategory.VIANDE, new Map())).toBeNull();
  });
});
