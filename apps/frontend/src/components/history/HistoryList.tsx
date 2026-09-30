/**
 * Liste des repas passés, groupés par semaine (maquette « Historique » et fiche client).
 */

import { OrderStatus } from '@meal-app/shared';
import { Icon } from '../ui/Icon';
import { SectionTitle, Stars } from '../ui/Controls';
import { addDays, dayOfWeek } from '@meal-app/shared';
import { capitalize, dayNumber, formatMonthYear, formatWeekday } from '../../lib/format';

export interface HistoryRow {
  orderId: number;
  date: string;
  statut: OrderStatus;
  estDefaut: boolean;
  platNom: string | null;
  accompagnementNom: string | null;
  viandeNom?: string | null;
  noteEtoile?: number | null;
  commentaire?: string | null;
  avisPossible?: boolean;
}

function mondayOf(dateIso: string): string {
  return addDays(dateIso, -((dayOfWeek(dateIso) + 6) % 7));
}

/** Regroupe par « Cette semaine », « Semaine dernière », puis par mois */
export function groupByPeriod<T extends { date: string }>(rows: T[], today: string): { label: string; rows: T[] }[] {
  const thisMonday = mondayOf(today);
  const lastMonday = addDays(thisMonday, -7);
  const groups: { label: string; rows: T[] }[] = [];

  for (const row of rows) {
    const label =
      row.date >= thisMonday
        ? 'Cette semaine'
        : row.date >= lastMonday
          ? 'Semaine dernière'
          : capitalize(formatMonthYear(row.date));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

export function HistoryList({
  rows,
  today,
  audience,
  onRate,
}: {
  rows: HistoryRow[];
  today: string;
  audience: 'client' | 'admin';
  onRate?: (row: HistoryRow) => void;
}) {
  const statusLabel = (row: HistoryRow): { text: string; className: string } => {
    if (row.statut === OrderStatus.ANNULEE) return { text: 'Annulé', className: 'text-danger' };
    if (row.estDefaut) {
      return { text: audience === 'client' ? 'Choisi pour toi' : 'Par défaut', className: 'text-muted' };
    }
    return { text: audience === 'client' ? 'Choisi par toi' : 'Choisi', className: 'text-accent-strong' };
  };

  return (
    <div className="flex flex-col gap-6">
      {groupByPeriod(rows, today).map((group, groupIndex) => (
        <section key={group.label} className="a-rise" style={{ animationDelay: `${0.1 + groupIndex * 0.08}s` }}>
          <SectionTitle className="mb-2">{group.label}</SectionTitle>
          <ul>
            {group.rows.map((row, index) => {
              const cancelled = row.statut === OrderStatus.ANNULEE;
              const status = statusLabel(row);
              const sides = [row.accompagnementNom, row.viandeNom].filter(Boolean).join(', ').toLowerCase();
              return (
                <li
                  key={row.orderId}
                  className={`flex gap-3 py-3 ${index < group.rows.length - 1 ? 'border-b border-line/[0.08]' : ''}`}
                >
                  <span
                    className={`mt-0.5 flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-field font-serif text-[16px] tabular-nums ${
                      cancelled ? 'text-muted' : 'text-ink'
                    }`}
                  >
                    {dayNumber(row.date)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[15px] font-semibold ${cancelled ? 'text-muted' : 'text-ink'}`}>
                        {cancelled ? 'Repas annulé' : row.platNom}
                      </span>
                      <span className={`flex-none text-[12px] font-semibold ${status.className}`}>{status.text}</span>
                    </div>
                    <span className="text-[13px] leading-snug text-ink-soft">
                      {capitalize(formatWeekday(row.date))}, {cancelled ? 'à une prochaine fois' : sides || 'sans accompagnement'}
                    </span>
                    {(row.noteEtoile || row.commentaire) && (
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
                        {row.noteEtoile ? <Stars value={row.noteEtoile} size={13} /> : null}
                        {row.commentaire}
                      </span>
                    )}
                    {row.avisPossible && onRate && (
                      <button
                        type="button"
                        onClick={() => onRate(row)}
                        className="press mt-1 flex items-center gap-1.5 self-start text-[13px] font-semibold text-accent-strong"
                      >
                        <Icon name="star" size={14} />
                        Noter ce repas
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
