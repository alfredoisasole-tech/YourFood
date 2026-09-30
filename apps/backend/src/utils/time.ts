/**
 * Utilitaires temporels avec fuseau horaire obligatoire : Africa/Kinshasa.
 * Conforme à SPEC.md (section 2 & 5.6) et AG_RULES.md.
 *
 * Les règles de calendrier (lundi/vendredi, jours ouvrés, viande selon la formule) vivent dans
 * `@meal-app/shared` pour être identiques côté frontend ; ce fichier ne porte que ce qui dépend
 * de l'horloge du serveur.
 */

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import {
  SubscriptionPlan,
  MenuTimeStatus,
  LOCK_TIME,
  addDays,
  isMeatIncluded,
  isWeekday,
} from '@meal-app/shared';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export const TIMEZONE = 'Africa/Kinshasa';

/** Retourne l'instance dayjs courante calée sur le fuseau horaire de Kinshasa */
export function nowKinshasa(): dayjs.Dayjs {
  return dayjs().tz(TIMEZONE);
}

/** Formate la date du jour au format YYYY-MM-DD */
export function getTodayDateString(): string {
  return nowKinshasa().format('YYYY-MM-DD');
}

/** Convertit une date "YYYY-MM-DD" en Date UTC minuit, comme attendu par les colonnes @db.Date */
export function toDbDate(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00.000Z`);
}

/** Convertit une colonne @db.Date en "YYYY-MM-DD" */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Minutes écoulées depuis minuit (heure de Kinshasa) */
function minutesSinceMidnight(now: dayjs.Dayjs): number {
  return now.hour() * 60 + now.minute();
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours as number) * 60 + (minutes as number);
}

/**
 * Vérifie si l'heure limite indicative (ex: 13:00) est dépassée pour le jour courant.
 * Si oui, le choix reste possible mais s'affiche en retard (SPEC 5.6).
 */
export function isPastIndicativeDeadline(deadline = '13:00'): boolean {
  return minutesSinceMidnight(nowKinshasa()) > parseTimeToMinutes(deadline);
}

/**
 * Vérifie si l'heure limite absolue de 20h00 est atteinte ou dépassée (SPEC 5.6).
 * 20h = limite absolue, verrouillage total, menu grisé.
 */
export function isPastAbsoluteDeadline(): boolean {
  return minutesSinceMidnight(nowKinshasa()) >= parseTimeToMinutes(LOCK_TIME);
}

/**
 * Le menu d'une date donnée est-il verrouillé ? Oui si la date est passée,
 * ou si c'est aujourd'hui et qu'il est 20h00 ou plus (SPEC 5.6).
 */
export function isLockTimeReached(dateIso: string): boolean {
  const today = getTodayDateString();
  if (dateIso < today) {
    return true;
  }
  return dateIso === today && isPastAbsoluteDeadline();
}

/**
 * Détermine le statut temporel d'une offre pour aujourd'hui :
 * - 'normal' : avant l'heure limite indicative (13h par défaut)
 * - 'en_retard' : entre l'heure indicative et 20h
 * - 'verrouille' : à partir de 20h
 */
export function getOfferTimeStatus(deadline = '13:00'): Exclude<MenuTimeStatus, 'aucun_menu'> {
  if (isPastAbsoluteDeadline()) {
    return 'verrouille';
  }
  if (isPastIndicativeDeadline(deadline)) {
    return 'en_retard';
  }
  return 'normal';
}

/**
 * Vérifie si la viande est incluse selon la formule et le jour de la semaine (SPEC 4 & 5.6).
 * - Formule 25 000 FC : viande UNIQUEMENT le lundi et le vendredi.
 * - Formule 35 000 FC : viande du lundi au vendredi.
 */
export function isMeatAllowed(formule: SubscriptionPlan | string, targetDate: string): boolean {
  return isMeatIncluded(formule as SubscriptionPlan, targetDate);
}

/**
 * Génère la liste des N prochains jours ouvrés (du lundi au vendredi), `startDateStr` inclus s'il est ouvré.
 * Utilisé pour la publication multi-jours (SPEC 5.5).
 */
export function getWorkingDays(startDateStr: string, count: number): string[] {
  const workingDays: string[] = [];
  let current = startDateStr;

  while (workingDays.length < count) {
    if (isWeekday(current)) {
      workingDays.push(current);
    }
    current = addDays(current, 1);
  }

  return workingDays;
}
