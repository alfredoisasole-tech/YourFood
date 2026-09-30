/**
 * Mise en forme des repas (commandes) pour les vues admin et client.
 */

interface NamedOption {
  catalogItem: { nom: string };
}

interface OrderWithMeal {
  plat?: NamedOption | null;
  accompagnement?: NamedOption | null;
  viande?: NamedOption | null;
}

/** « Riz cantonais · Salade fraîche · Poulet grillé » — vide si la commande a été annulée sans choix */
export function mealLabel(order: OrderWithMeal): string {
  return [order.plat, order.accompagnement, order.viande]
    .filter((option): option is NamedOption => Boolean(option))
    .map((option) => option.catalogItem.nom)
    .join(' · ');
}
