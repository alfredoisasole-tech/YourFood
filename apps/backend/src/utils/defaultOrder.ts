/**
 * Calcul de la commande par défaut (SPEC 5.8).
 *
 * Un client qui n'a rien choisi ni annulé avant 20h reçoit, catégorie par catégorie, l'option la plus
 * demandée parmi les commandes du jour (ou la première option si personne n'a encore commandé).
 * La viande n'est attribuée que si la formule du client l'inclut ce jour-là.
 */

import { ItemCategory } from '@meal-app/shared';

export interface OfferOptionRef {
  id: number;
  categorie: ItemCategory;
}

export interface PlacedChoice {
  platId: number | null;
  accompagnementId: number | null;
  viandeId: number | null;
}

export interface DefaultChoices {
  platId: number;
  accompagnementId: number;
  /** null si le menu ne propose aucune viande */
  viandeId: number | null;
}

/**
 * Option la plus demandée d'une catégorie. À égalité, la première option du menu l'emporte
 * (plus petit identifiant). Retourne null si le menu n'a aucune option dans la catégorie.
 */
export function pickMostRequested(
  options: OfferOptionRef[],
  categorie: ItemCategory,
  counts: Map<number, number>
): number | null {
  const candidates = options.filter((o) => o.categorie === categorie).sort((a, b) => a.id - b.id);
  if (candidates.length === 0) {
    return null;
  }

  let best = candidates[0] as OfferOptionRef;
  for (const candidate of candidates) {
    if ((counts.get(candidate.id) ?? 0) > (counts.get(best.id) ?? 0)) {
      best = candidate;
    }
  }
  return best.id;
}

function countChoices(ids: (number | null)[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of ids) {
    if (id !== null) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Commande par défaut du jour, à partir des choix réellement passés (commandes annulées exclues).
 * Lève une erreur si le menu n'a aucun plat ou aucun accompagnement : un tel menu ne peut pas être publié.
 */
export function computeDefaultChoices(
  options: OfferOptionRef[],
  placed: PlacedChoice[]
): DefaultChoices {
  const platId = pickMostRequested(
    options,
    ItemCategory.PLAT,
    countChoices(placed.map((o) => o.platId))
  );
  const accompagnementId = pickMostRequested(
    options,
    ItemCategory.ACCOMPAGNEMENT,
    countChoices(placed.map((o) => o.accompagnementId))
  );
  const viandeId = pickMostRequested(
    options,
    ItemCategory.VIANDE,
    countChoices(placed.map((o) => o.viandeId))
  );

  if (platId === null || accompagnementId === null) {
    throw new Error('Le menu doit proposer au moins un plat et un accompagnement');
  }

  return { platId, accompagnementId, viandeId };
}
