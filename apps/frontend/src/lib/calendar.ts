/**
 * Calculs de calendrier côté interface (jours ouvrés, lundis), sur des dates « YYYY-MM-DD ».
 */

import { addDays, dayOfWeek, isWeekday } from '@meal-app/shared';

export function mondayOf(dateIso: string): string {
  return addDays(dateIso, -((dayOfWeek(dateIso) + 6) % 7));
}

/** Prochain jour ouvré strictement après `dateIso` */
export function nextWorkingDay(dateIso: string): string {
  let current = addDays(dateIso, 1);
  while (!isWeekday(current)) current = addDays(current, 1);
  return current;
}

/** `dateIso` s'il est ouvré, sinon le jour ouvré suivant */
export function workingDayFrom(dateIso: string): string {
  return isWeekday(dateIso) ? dateIso : nextWorkingDay(dateIso);
}

/** `count` jours ouvrés à partir de `start` (inclus s'il est ouvré) */
export function workingDays(start: string, count: number): string[] {
  const days: string[] = [];
  for (let current = start; days.length < count; current = addDays(current, 1)) {
    if (isWeekday(current)) days.push(current);
  }
  return days;
}

/** Les `count` prochains lundis ; inclut `today` si c'est un lundi */
export function upcomingMondays(today: string, count: number): string[] {
  const first = dayOfWeek(today) === 1 ? today : addDays(today, (8 - dayOfWeek(today)) % 7 || 7);
  return Array.from({ length: count }, (_, index) => addDays(first, index * 7));
}
