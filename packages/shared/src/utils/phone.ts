/**
 * Normalisation des numéros de téléphone (SPEC 5.1 : indicatif pays obligatoire à la saisie).
 */

/** Retire espaces, points, tirets et parenthèses : « +243 81 234 5678 » → « +243812345678 » */
export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s.\-()]/g, '');
}

export const INTERNATIONAL_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export function isValidPhone(raw: string): boolean {
  return INTERNATIONAL_PHONE_REGEX.test(normalizePhone(raw));
}
