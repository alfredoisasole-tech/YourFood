/**
 * Identifiant de connexion d'un utilisateur : « prénom nom » normalisé.
 *
 * La comparaison ignore la casse, les accents et les espaces multiples, si bien que
 * « Joséphine  Tshimanga » et « josephine tshimanga » désignent le même compte.
 * La clé est unique en base : deux clients ne peuvent pas partager le même prénom + nom.
 */

/** Minuscules, sans accents, espaces simplifiés */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildLoginKey(prenom: string, nom: string): string {
  return normalizeName(`${prenom} ${nom}`);
}

/**
 * Clés à essayer pour un identifiant saisi : tel quel, puis — s'il tient en deux mots —
 * dans l'ordre inverse, pour tolérer « Nom Prénom ».
 */
export function loginKeyCandidates(identifiant: string): string[] {
  const key = normalizeName(identifiant);
  const words = key.split(' ');
  if (words.length === 2) {
    return [key, `${words[1]} ${words[0]}`];
  }
  return [key];
}
