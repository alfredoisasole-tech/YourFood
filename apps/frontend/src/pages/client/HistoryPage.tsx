/**
 * « Historique » : les repas passés du client, en lecture seule, avec recherche par plat,
 * filtre par dates et avis a posteriori (SPEC 7).
 */

import { useEffect, useState } from 'react';
import { clientApi } from '../../api/endpoints';
import { useApi } from '../../hooks/useApi';
import { ClientShell, useClientArea } from './ClientArea';
import { HistoryList, type HistoryRow } from '../../components/history/HistoryList';
import { DateRangePanel, type DateRange } from '../../components/history/DateRangePanel';
import { RateMealSheet } from '../../components/history/RateMealSheet';
import { Icon } from '../../components/ui/Icon';
import { EmptyState, ErrorState, SectionLoader } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { formatDayMonth, formatMonthYear, todayKinshasa } from '../../lib/format';

export function HistoryPage() {
  const { refreshAll } = useClientArea();
  const toast = useToast();
  const today = todayKinshasa();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<DateRange | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [rating, setRating] = useState<HistoryRow | null>(null);

  // Recherche à la frappe, avec un léger délai
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const history = useApi(() => clientApi.history({ q: query || undefined, from: range?.from, to: range?.to }), [query, range?.from, range?.to]);
  const filtered = Boolean(query || range);

  return (
    <ClientShell title="Historique" photo="/images/photo-historique.jpg">
      <div className="a-rise d2 mt-5 flex flex-col gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{formatMonthYear(today)}</p>
        <h1 className="font-serif text-[42px] leading-[1.05] tracking-[-0.01em] text-ink">Tes derniers repas.</h1>
      </div>

      <div className="a-rise d3 mt-5 flex items-center gap-2">
        <label className="flex h-[52px] min-w-0 flex-1 items-center gap-3 rounded-full border border-line/[0.1] bg-surface px-5 text-ink-soft shadow-soft focus-within:border-accent/40">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Retrouve un plat…"
            aria-label="Retrouve un plat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none"
          />
        </label>
        <button
          type="button"
          aria-label="Filtrer par date"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((v) => !v)}
          className={`press flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full ${
            range || filterOpen ? 'bg-accent text-on-accent' : 'border border-line/[0.12] bg-surface text-ink-soft'
          }`}
        >
          <Icon name="sliders" />
        </button>
      </div>

      {filterOpen && (
        <div className="mt-3">
          <DateRangePanel
            today={today}
            value={range}
            onApply={(next) => {
              setRange(next);
              setFilterOpen(false);
            }}
          />
        </div>
      )}

      {range && !filterOpen && (
        <button
          type="button"
          onClick={() => setRange(null)}
          className="a-pop mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-accent/10 px-3 text-[13px] font-semibold text-accent-strong"
        >
          Du {formatDayMonth(range.from)} au {formatDayMonth(range.to)}
          <Icon name="x" size={14} />
        </button>
      )}

      <div className="mt-6">
        {history.loading && !history.data ? (
          <SectionLoader />
        ) : history.error ? (
          <ErrorState message={history.error.message} onRetry={() => void history.reload()} />
        ) : history.data && history.data.length > 0 ? (
          <HistoryList rows={history.data} today={today} audience="client" onRate={setRating} />
        ) : (
          <EmptyState icon="calendar" title={filtered ? 'Aucun repas trouvé' : 'Pas encore de repas'}>
            {filtered ? 'Essaie un autre plat ou une autre période.' : 'Tes repas apparaîtront ici après chaque service.'}
          </EmptyState>
        )}
      </div>

      <RateMealSheet
        row={rating}
        onClose={() => setRating(null)}
        onSaved={() => {
          setRating(null);
          toast.show('Merci pour ton avis !');
          void history.reload(true);
          void refreshAll();
        }}
      />
    </ClientShell>
  );
}
