/**
 * Règles de dates et d'abonnement partagées entre backend et frontend (SPEC 5.1, 5.11, 6).
 *
 * Toutes les dates sont des chaînes "YYYY-MM-DD" (jours civils, sans heure) :
 * les calculs se font en UTC pour éviter tout décalage lié au fuseau du navigateur ou du serveur.
 *
 * Règles métier :
 * - un abonnement commence toujours un lundi et se termine toujours un vendredi ;
 * - sa durée se compte en semaines (1 mois = 4 semaines) ;
 * - les « jours restants » sont des jours ouvrés (lundi-vendredi), aujourd'hui inclus.
 */

import { SubscriptionPlan } from '../types';

// ─── Constantes métier ─────────────────────────────────────────

/** Nombre de semaines d'un « mois » d'abonnement */
export const WEEKS_PER_MONTH = 4;

/** Un abonnement est « bientôt expiré » à partir de ce nombre de jours ouvrés restants */
export const EXPIRING_SOON_WORKING_DAYS = 10;

/** Prix hebdomadaires en FC : pour plusieurs semaines, on additionne simplement */
export const WEEKLY_PRICE_FC: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.PLAN_25000]: 25000,
  [SubscriptionPlan.PLAN_35000]: 35000,
};

export type DurationUnit = 'semaines' | 'mois';

export interface SubscriptionDuration {
  unite: DurationUnit;
  valeur: number;
}

/** Limites proposées par l'interface : 1 à 3 semaines, ou 1 à 12 mois */
export const MAX_DURATION_VALUE: Record<DurationUnit, number> = {
  semaines: 3,
  mois: 12,
};

/**
 * État d'un abonnement vu d'aujourd'hui.
 * - non_commence : la période démarre plus tard ;
 * - actif : en cours ;
 * - bientot_expire : en cours, mais il reste peu de jours ouvrés ;
 * - expire : la période est terminée.
 */
export type SubscriptionState = 'non_commence' | 'actif' | 'bientot_expire' | 'expire';

export interface SubscriptionPeriod {
  dateDebut: string;
  dateFin: string;
}

// ─── Primitives de dates (UTC) ─────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMs(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year as number, (month as number) - 1, day as number);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUtcMs(toUtcMs(iso) + days * DAY_MS);
}

/** Jour de la semaine : 0 = dimanche, 1 = lundi, ..., 6 = samedi */
export function dayOfWeek(iso: string): number {
  return new Date(toUtcMs(iso)).getUTCDay();
}

export function isWeekday(iso: string): boolean {
  const day = dayOfWeek(iso);
  return day !== 0 && day !== 6;
}

export function isMonday(iso: string): boolean {
  return dayOfWeek(iso) === 1;
}

/**
 * Premier lundi à partir de `iso`.
 * Par défaut le lundi est strictement postérieur ; avec `includeToday`, un lundi renvoie lui-même.
 */
export function nextMonday(iso: string, includeToday = false): string {
  const delta = (8 - dayOfWeek(iso)) % 7;
  if (delta === 0) {
    return includeToday ? iso : addDays(iso, 7);
  }
  return addDays(iso, delta);
}

/** Dernier jour ouvré strictement avant `iso` (le lundi renvoie le vendredi précédent) */
export function previousWorkingDay(iso: string): string {
  let current = addDays(iso, -1);
  while (!isWeekday(current)) {
    current = addDays(current, -1);
  }
  return current;
}

/** Nombre de jours ouvrés entre deux dates, bornes incluses (0 si `to` précède `from`) */
export function countWorkingDays(from: string, to: string): number {
  if (toUtcMs(to) < toUtcMs(from)) {
    return 0;
  }
  let count = 0;
  for (let current = from; toUtcMs(current) <= toUtcMs(to); current = addDays(current, 1)) {
    if (isWeekday(current)) {
      count++;
    }
  }
  return count;
}

// ─── Durée, fin et prix ────────────────────────────────────────

export function durationToWeeks(duration: SubscriptionDuration): number {
  return duration.unite === 'mois' ? duration.valeur * WEEKS_PER_MONTH : duration.valeur;
}

/**
 * Date de fin d'un abonnement : le vendredi de la dernière semaine.
 * Le début doit être un lundi (règle métier de l'administratrice).
 */
export function computeSubscriptionEnd(dateDebut: string, weeks: number): string {
  if (!isMonday(dateDebut)) {
    throw new RangeError('Un abonnement doit commencer un lundi');
  }
  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new RangeError('La durée doit être d\'au moins une semaine');
  }
  return addDays(dateDebut, weeks * 7 - 3);
}

/** Nombre de semaines d'une période (début lundi, fin vendredi) */
export function periodWeeks(period: SubscriptionPeriod): number {
  return Math.max(1, Math.ceil(countWorkingDays(period.dateDebut, period.dateFin) / 5));
}

/** Total en FC : prix hebdomadaire × nombre de semaines */
export function subscriptionTotalFc(formule: SubscriptionPlan, weeks: number): number {
  return WEEKLY_PRICE_FC[formule] * weeks;
}

/** La formule inclut-elle la viande ce jour-là ? (SPEC 4) */
export function isMeatIncluded(formule: SubscriptionPlan, dateIso: string): boolean {
  const day = dayOfWeek(dateIso);
  if (day === 0 || day === 6) {
    return false;
  }
  if (formule === SubscriptionPlan.PLAN_35000) {
    return true;
  }
  return day === 1 || day === 5;
}

// ─── État d'un abonnement ──────────────────────────────────────

export function periodCoversDate(period: SubscriptionPeriod, dateIso: string): boolean {
  return period.dateDebut <= dateIso && dateIso <= period.dateFin;
}

export function getSubscriptionState(
  period: SubscriptionPeriod,
  todayIso: string
): { etat: SubscriptionState; joursRestants: number } {
  if (todayIso < period.dateDebut) {
    return {
      etat: 'non_commence',
      joursRestants: countWorkingDays(period.dateDebut, period.dateFin),
    };
  }
  if (todayIso > period.dateFin) {
    return { etat: 'expire', joursRestants: 0 };
  }
  const joursRestants = countWorkingDays(todayIso, period.dateFin);
  return {
    etat: joursRestants <= EXPIRING_SOON_WORKING_DAYS ? 'bientot_expire' : 'actif',
    joursRestants,
  };
}

/** L'abonnement donne-t-il accès à la commande aujourd'hui ? */
export function isSubscriptionRunning(etat: SubscriptionState): boolean {
  return etat === 'actif' || etat === 'bientot_expire';
}

/**
 * Choisit la période « courante » d'un client parmi tout son historique :
 * 1. celle qui couvre aujourd'hui ;
 * 2. sinon la prochaine à venir ;
 * 3. sinon la plus récente (abonnement expiré).
 */
export function pickCurrentPeriod<T extends SubscriptionPeriod>(
  periods: T[],
  todayIso: string
): T | null {
  if (periods.length === 0) {
    return null;
  }
  const covering = periods
    .filter((p) => periodCoversDate(p, todayIso))
    .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
  if (covering[0]) {
    return covering[0];
  }
  const upcoming = periods
    .filter((p) => p.dateDebut > todayIso)
    .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  if (upcoming[0]) {
    return upcoming[0];
  }
  return [...periods].sort((a, b) => b.dateFin.localeCompare(a.dateFin))[0] ?? null;
}
