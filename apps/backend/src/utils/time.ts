/**
 * Utilitaires temporels avec fuseau horaire obligatoire : Africa/Kinshasa.
 * Conforme à SPEC.md (section 2 & 5.6) et AG_RULES.md.
 */

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { SubscriptionPlan } from '@meal-app/shared';

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

/**
 * Vérifie si l'heure limite indicative (ex: 13:00) est dépassée pour le jour courant.
 * Si oui, le choix reste possible mais s'affiche en retard (SPEC 5.6).
 */
export function isPastIndicativeDeadline(deadline = '13:00'): boolean {
  const now = nowKinshasa();
  const [hours, minutes] = deadline.split(':').map(Number);
  const deadlineToday = now.hour(hours).minute(minutes).second(0).millisecond(0);
  return now.isAfter(deadlineToday);
}

/**
 * Vérifie si l'heure limite absolue de 20h00 est atteinte ou dépassée (SPEC 5.6).
 * 20h = limite absolue, verrouillage total, menu grisé.
 */
export function isPastAbsoluteDeadline(): boolean {
  const now = nowKinshasa();
  const limitToday = now.hour(20).minute(0).second(0).millisecond(0);
  return now.isSameOrAfter(limitToday);
}

/**
 * Détermine le statut temporel d'une offre pour aujourd'hui :
 * - 'normal' : avant l'heure limite indicative (13h)
 * - 'en_retard' : entre 13h et 20h
 * - 'verrouille' : à partir de 20h
 */
export function getOfferTimeStatus(deadline = '13:00'): 'normal' | 'en_retard' | 'verrouille' {
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
 * - Formule 25 000 FC : Viande incluse UNIQUEMENT le lundi (1) et le vendredi (5).
 * - Formule 35 000 FC : Viande incluse du lundi au vendredi.
 */
export function isMeatAllowed(formule: SubscriptionPlan | string, targetDate: string | Date): boolean {
  const dateObj = dayjs(targetDate).tz(TIMEZONE);
  const dayOfWeek = dateObj.day(); // 0 = Dimanche, 1 = Lundi, ..., 5 = Vendredi, 6 = Samedi

  // Le week-end n'a pas de livraison
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  if (formule === SubscriptionPlan.PLAN_35000 || formule === '35000') {
    return true;
  }

  // Formule 25 000 : Lundi (1) et Vendredi (5) uniquement
  return dayOfWeek === 1 || dayOfWeek === 5;
}

/**
 * Calcule la date de fin d'un abonnement (SPEC 5.1 & 8).
 * date_fin = date_debut + durée en jours.
 */
export function calculateSubscriptionEndDate(startDateStr: string, durationDays: number): string {
  return dayjs(startDateStr).tz(TIMEZONE).add(durationDays, 'day').format('YYYY-MM-DD');
}

/**
 * Génère la liste des N prochains jours ouvrés (du lundi au vendredi).
 * Utilisé pour la publication multi-jours (SPEC 5.5).
 */
export function getWorkingDays(startDateStr: string, count: number): string[] {
  const workingDays: string[] = [];
  let current = dayjs(startDateStr).tz(TIMEZONE);

  while (workingDays.length < count) {
    const day = current.day();
    if (day !== 0 && day !== 6) {
      workingDays.push(current.format('YYYY-MM-DD'));
    }
    current = current.add(1, 'day');
  }

  return workingDays;
}
