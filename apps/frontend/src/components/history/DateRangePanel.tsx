/**
 * Filtre par dates de l'historique (maquette) : raccourcis et calendrier du mois,
 * où l'on touche une date de début puis une date de fin.
 */

import { useState } from 'react';
import { addDays, dayOfWeek } from '@meal-app/shared';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { capitalize, formatDayMonth, formatMonthYear } from '../../lib/format';

export interface DateRange {
  from: string;
  to: string;
}

function mondayOf(dateIso: string): string {
  return addDays(dateIso, -((dayOfWeek(dateIso) + 6) % 7));
}

function monthStart(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`;
}

function shiftMonth(firstOfMonth: string, delta: number): string {
  const [year, month] = firstOfMonth.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 10);
}

export function presetRanges(today: string): { label: string; range: DateRange }[] {
  const monday = mondayOf(today);
  return [
    { label: 'Cette semaine', range: { from: monday, to: today } },
    { label: 'Semaine dernière', range: { from: addDays(monday, -7), to: addDays(monday, -3) } },
    { label: '15 derniers jours', range: { from: addDays(today, -14), to: today } },
    { label: 'Ce mois-ci', range: { from: monthStart(today), to: today } },
  ];
}

export function DateRangePanel({
  today,
  value,
  onApply,
}: {
  today: string;
  value: DateRange | null;
  onApply: (range: DateRange | null) => void;
}) {
  const [draft, setDraft] = useState<{ from: string; to: string | null } | null>(value);
  const [month, setMonth] = useState(monthStart(value?.from ?? today));

  const lo = draft ? (draft.to && draft.to < draft.from ? draft.to : draft.from) : null;
  const hi = draft ? (draft.to && draft.to > draft.from ? draft.to : draft.from) : null;

  const pickDay = (date: string) => {
    if (!draft || draft.to) setDraft({ from: date, to: null });
    else setDraft({ from: draft.from, to: date });
  };

  // Grille du mois, lundi en premier
  const offset = (dayOfWeek(month) + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = month; day.startsWith(month.slice(0, 7)); day = addDays(day, 1)) cells.push(day);

  const presets = presetRanges(today);

  return (
    <div className="a-drop flex flex-col gap-4 rounded-4xl border border-line/[0.08] bg-page p-4">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold text-ink">Filtrer par date</span>
        <button type="button" onClick={() => setDraft(null)} className="text-[13px] font-semibold text-accent-strong">
          Réinitialiser
        </button>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {presets.map((preset) => {
          const on = lo === preset.range.from && hi === preset.range.to;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDraft({ from: preset.range.from, to: preset.range.to })}
              className={`press h-9 flex-none rounded-full px-3.5 text-[13px] font-semibold ${
                on ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink-soft'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5">
          <Icon name="chevronLeft" size={18} />
        </button>
        <span className="text-[14px] font-semibold text-ink">{capitalize(formatMonthYear(month))}</span>
        <button
          type="button"
          aria-label="Mois suivant"
          disabled={month >= monthStart(today)}
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 disabled:opacity-30"
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((letter, index) => (
          <span key={index} className="pb-1 text-[12px] font-semibold text-muted">
            {letter}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`vide-${index}`} />;
          const weekend = dayOfWeek(date) === 0 || dayOfWeek(date) === 6;
          const future = date > today;
          const off = weekend || future;
          const edge = date === lo || date === hi;
          const inside = lo && hi && date > lo && date < hi;
          const span = lo && hi && lo !== hi && (inside || edge);
          return (
            <div
              key={date}
              className={`flex h-9 justify-center ${span ? 'bg-accent/[0.12]' : ''} ${
                span && date === lo ? 'rounded-l-full' : ''
              } ${span && date === hi ? 'rounded-r-full' : ''}`}
            >
              <button
                type="button"
                disabled={off}
                onClick={() => pickDay(date)}
                aria-pressed={edge}
                className={`h-9 w-9 rounded-full text-[14px] tabular-nums transition-colors ${
                  edge ? 'bg-accent font-semibold text-on-accent' : off ? 'text-muted opacity-45' : 'font-medium text-ink'
                }`}
              >
                {Number(date.slice(8))}
              </button>
            </div>
          );
        })}
      </div>

      <Button size="md" onClick={() => onApply(lo && hi ? { from: lo, to: hi } : null)}>
        {lo && hi
          ? lo === hi
            ? `Voir les repas du ${formatDayMonth(lo)}`
            : `Voir les repas du ${formatDayMonth(lo)} au ${formatDayMonth(hi)}`
          : 'Voir tous les repas'}
      </Button>
    </div>
  );
}
