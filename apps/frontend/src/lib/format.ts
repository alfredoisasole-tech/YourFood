/**
 * Mise en forme des dates, montants et noms, en français et à l'heure de Kinshasa.
 * Les dates métier sont des chaînes « YYYY-MM-DD » (jours civils) : elles sont lues à midi UTC
 * pour qu'aucun fuseau ne les décale d'un jour.
 */

import { SubscriptionPlan } from '@meal-app/shared';

export const TIMEZONE = 'Africa/Kinshasa';

function atNoon(dateIso: string): Date {
  return new Date(`${dateIso}T12:00:00.000Z`);
}

function format(dateIso: string, options: Intl.DateTimeFormatOptions): string {
  return atNoon(dateIso).toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' });
}

/** « mardi 29 septembre » */
export function formatLongDate(dateIso: string): string {
  return format(dateIso, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** « Mardi 29 septembre » */
export function formatLongDateCap(dateIso: string): string {
  return capitalize(formatLongDate(dateIso));
}

/** « mardi 29 septembre 2026 » */
export function formatFullDate(dateIso: string): string {
  return format(dateIso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** « 29 septembre » */
export function formatDayMonth(dateIso: string): string {
  return format(dateIso, { day: 'numeric', month: 'long' });
}

/** « lun. 28 sept. » */
export function formatShortDate(dateIso: string): string {
  return format(dateIso, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** « lundi » */
export function formatWeekday(dateIso: string): string {
  return format(dateIso, { weekday: 'long' });
}

/** « lun. » */
export function formatWeekdayShort(dateIso: string): string {
  return format(dateIso, { weekday: 'short' });
}

/** « septembre 2026 » */
export function formatMonthYear(dateIso: string): string {
  return format(dateIso, { month: 'long', year: 'numeric' });
}

export function dayNumber(dateIso: string): number {
  return Number(dateIso.slice(8, 10));
}

/** « Du 7 septembre au 30 octobre » */
export function formatPeriod(dateDebut: string, dateFin: string): string {
  return `Du ${formatDayMonth(dateDebut)} au ${formatDayMonth(dateFin)}`;
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** « 35 000 FC » */
export function formatFc(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/ | /g, ' ')} FC`;
}

/** « 13:00 » devient « 13h00 » */
export function formatTime(time: string): string {
  return time.replace(':', 'h');
}

/** « +243812345678 » devient « +243 81 234 5678 » (numéros congolais), sinon inchangé */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const match = /^\+243(\d{2})(\d{3})(\d{4})$/.exec(phone);
  return match ? `+243 ${match[1]} ${match[2]} ${match[3]}` : phone;
}

/** Initiales « MK » à partir du prénom et du nom */
export function initials(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase();
}

export function fullName(person: { prenom: string; nom: string }): string {
  return `${person.prenom} ${person.nom}`;
}

export const FORMULE_LABEL: Record<SubscriptionPlan, string> = {
  [SubscriptionPlan.PLAN_25000]: 'Formule 1',
  [SubscriptionPlan.PLAN_35000]: 'Formule 2',
};

export const FORMULE_DESCRIPTION: Record<SubscriptionPlan, string> = {
  [SubscriptionPlan.PLAN_25000]: 'Viande le lundi et le vendredi',
  [SubscriptionPlan.PLAN_35000]: 'Viande tous les jours',
};

/** Pluriel simple : plural(2, 'plat') → « 2 plats » */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

// ─── Heure de Kinshasa ────────────────────────────────────────────────

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export interface KinshasaClock {
  date: string;
  /** Secondes écoulées depuis minuit */
  seconds: number;
}

/** Date du jour et heure à Kinshasa pour un instant donné */
export function kinshasaClock(at: Date = new Date()): KinshasaClock {
  const parts = Object.fromEntries(partsFormatter.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

export function todayKinshasa(): string {
  return kinshasaClock().date;
}

export function timeToSeconds(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 3600 + (minutes ?? 0) * 60;
}

/** « 09:41:55 » */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
