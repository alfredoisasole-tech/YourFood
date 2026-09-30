/**
 * Générateur de code d'activation à 8 caractères.
 * Conforme à SPEC.md (section 2 & 5.2) :
 * - 2 initiales (nom + prénom) en majuscules
 * - 6 caractères aléatoires sécurisés via crypto natif (lettres, chiffres, '-', '_', '.')
 */

import crypto from 'crypto';

const ALLOWED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.' as const;

/**
 * Nettoie une chaîne pour extraire une initiale alphabétique majuscule valide.
 */
function getInitial(str: string): string {
  const cleaned = str.trim().toUpperCase().replace(/[^A-Z]/g, '');
  return cleaned.charAt(0) || 'X';
}

/**
 * Génère 6 caractères aléatoires parmi l'alphabet autorisé en utilisant crypto.
 */
function generateRandomSuffix(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      result += ALLOWED_CHARS[byte % ALLOWED_CHARS.length];
    }
  }
  return result;
}

/**
 * Génère un code d'activation à 8 caractères au format : [InitialeNom][InitialePrenom][6 caractères aléatoires]
 */
export function generateActivationCode(nom: string, prenom: string): string {
  const initNom = getInitial(nom);
  const initPrenom = getInitial(prenom);
  const suffix = generateRandomSuffix(6);
  return `${initNom}${initPrenom}${suffix}`;
}
