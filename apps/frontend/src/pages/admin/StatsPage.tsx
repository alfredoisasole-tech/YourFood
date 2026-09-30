/**
 * « Les chiffres du jour. » (SPEC 6, maquette Statistiques) : livraisons du mois, tuiles,
 * plat le plus commandé par période, totaux par catégorie avec les nombres exacts.
 */

import { useEffect, useMemo, useState } from 'react';
import { ItemCategory, type TopDishPeriod } from '@meal-app/shared';
import { adminApi } from '../../api/endpoints';
import { useApi } from '../../hooks/useApi';
import { AdminPage } from './AdminArea';
import { Icon, type IconName } from '../../components/ui/Icon';
import { Chips, Ring } from '../../components/ui/Controls';
import { LinkButton } from '../../components/ui/Button';
import { ErrorState, SectionLoader } from '../../components/ui/States';
import { capitalize, dayNumber, formatLongDateCap, formatMonthYear, formatShortDate, plural, todayKinshasa } from '../../lib/format';

const PERIODS: { value: TopDishPeriod; label: string }[] = [
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'annee', label: 'Année' },
  { value: 'historique', label: 'Depuis le début' },
];

const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: ItemCategory.PLAT, label: 'Plat' },
  { value: ItemCategory.ACCOMPAGNEMENT, label: 'Accompagnement' },
  { value: ItemCategory.VIANDE, label: 'Viande' },
];

function Tile({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-[150px] flex-col justify-between rounded-4xl bg-surface p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <span className="text-accent">
          <Icon name={icon} size={18} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function StatsPage() {
  const today = todayKinshasa();
  const month = today.slice(0, 7);
  const overview = useApi(() => adminApi.statsOverview(), []);
  const deliveries = useApi(() => adminApi.deliveries(month), [month]);
  const [period, setPeriod] = useState<TopDishPeriod>('semaine');
  const [category, setCategory] = useState<ItemCategory>(ItemCategory.PLAT);
  const [selectedDay, setSelectedDay] = useState(today);

  const days = useMemo(() => deliveries.data ?? [], [deliveries.data]);
  useEffect(() => {
    if (days.length && !days.some((d) => d.date === selectedDay)) {
      setSelectedDay([...days].reverse().find((d) => !d.prevu)?.date ?? days[0]?.date ?? today);
    }
  }, [days, selectedDay, today]);

  const stats = overview.data;
  const max = Math.max(1, ...days.map((d) => d.livraisons));
  const current = days.find((d) => d.date === selectedDay);
  const top = stats?.platsPlusCommandes[period] ?? null;
  const totals = stats?.totauxParCategorie.find((t) => t.categorie === category);
  const maxItem = Math.max(1, ...(totals?.items.map((i) => i.quantite) ?? [1]));

  return (
    <AdminPage back="/admin" title="Les chiffres du jour." subtitle={formatLongDateCap(today)}>
      {overview.loading && !stats ? (
        <SectionLoader />
      ) : overview.error || !stats ? (
        <ErrorState message={overview.error?.message ?? 'Statistiques indisponibles.'} onRetry={() => void overview.reload()} />
      ) : (
        <div className="flex flex-col gap-3">
          <section className="a-rise d2 rounded-4xl bg-surface p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span className="text-accent">
                  <Icon name="dish" size={18} />
                </span>
                Livraisons
              </h2>
              <span className="text-[14px] text-ink-soft">{capitalize(formatMonthYear(today))}</span>
            </div>
            {current && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[26px] font-bold leading-none tabular-nums text-ink">{current.livraisons}</p>
                  <p className="mt-1 text-[12.5px] text-ink-soft">
                    {current.prevu ? 'prévues' : 'livraisons'} · {formatShortDate(current.date)}
                  </p>
                </div>
                <div>
                  <p className="text-[26px] font-bold leading-none tabular-nums text-ink">{current.pourcentage} %</p>
                  <p className="mt-1 text-[12.5px] text-ink-soft">des clients actifs</p>
                </div>
              </div>
            )}
            {deliveries.loading && !deliveries.data ? (
              <SectionLoader />
            ) : (
              <div className="no-scrollbar mt-4 flex h-[130px] items-end gap-1.5 overflow-x-auto">
                {days.map((day) => {
                  const on = day.date === selectedDay;
                  const height = 16 + Math.round((day.livraisons / max) * 90);
                  return (
                    <button
                      key={day.date}
                      type="button"
                      aria-label={`${day.prevu ? 'Prévu' : 'Livraisons'} le ${formatShortDate(day.date)} : ${day.livraisons}`}
                      onClick={() => setSelectedDay(day.date)}
                      className="flex min-w-[22px] flex-1 flex-col items-center gap-1.5"
                    >
                      <span className="relative flex w-full justify-center">
                        {on && (
                          <span className="a-pop absolute -top-7 rounded-full bg-ink px-1.5 py-0.5 text-[11px] font-bold text-page">
                            {day.livraisons}
                          </span>
                        )}
                        <span
                          style={{ height }}
                          className={`block w-full rounded-lg transition-colors ${
                            on
                              ? 'bg-[linear-gradient(180deg,rgb(var(--c-accent-bright)),rgb(var(--c-accent)))]'
                              : day.prevu
                                ? 'bg-accent/[0.07]'
                                : 'bg-accent/[0.18]'
                          }`}
                        />
                      </span>
                      <span className={`text-[11px] tabular-nums ${on ? 'font-bold text-ink' : 'text-muted'} ${day.prevu ? 'opacity-60' : ''}`}>
                        {dayNumber(day.date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="a-rise d3 grid grid-cols-2 gap-3">
            <Tile icon="users" title="Clients">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[28px] font-bold leading-none tabular-nums text-ink">{stats.clientsActifs}</p>
                  <p className="mt-1 text-[12.5px] text-ink-soft">actifs sur {stats.clientsTotal}</p>
                </div>
                <Ring percent={stats.clientsTotal ? (stats.clientsActifs / stats.clientsTotal) * 100 : 0} size={52} stroke={7} className="text-accent" trackClassName="text-accent opacity-15" />
              </div>
            </Tile>
            <Tile icon="star" title="Avis">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[28px] font-bold leading-none tabular-nums text-ink">
                    {stats.avis.moyenne === null ? '–' : stats.avis.moyenne.toLocaleString('fr-FR')}
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-soft">sur {plural(stats.avis.total, 'avis', 'avis')}</p>
                </div>
                <Ring percent={((stats.avis.moyenne ?? 0) / 5) * 100} size={52} stroke={7} className="text-warn" trackClassName="text-warn opacity-15" />
              </div>
            </Tile>
            <Tile icon="dish" title="Plat phare">
              <div>
                <p className="text-[28px] font-bold leading-none tabular-nums text-ink">{top?.quantite ?? 0}</p>
                <p className="mt-1 truncate text-[12.5px] text-ink-soft" title={top?.nom}>
                  {top?.nom ?? 'Aucune commande'}
                </p>
              </div>
            </Tile>
            <Tile icon="refresh" title="À renouveler">
              <div>
                <p className="text-[28px] font-bold leading-none tabular-nums text-ink">{stats.aRenouveler}</p>
                <p className="mt-1 text-[12.5px] text-ink-soft">bientôt expirés</p>
              </div>
            </Tile>
          </div>

          <div className="a-rise d3">
            <Chips options={PERIODS} value={period} onChange={setPeriod} label="Période du plat phare" />
          </div>

          <section className="a-rise d4 mt-3 rounded-4xl bg-surface p-4 shadow-soft">
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Totaux par catégorie</h2>
            <Chips options={CATEGORIES} value={category} onChange={setCategory} label="Catégorie" />
            <ul className="mt-4 flex flex-col gap-3">
              {(totals?.items ?? []).map((item) => {
                const lead = item.quantite === maxItem;
                return (
                  <li key={item.nom} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-[14px]">
                      <span className="truncate text-ink">{item.nom}</span>
                      <span className={`font-bold tabular-nums ${lead ? 'text-accent-strong' : 'text-ink-soft'}`}>{item.quantite}</span>
                    </div>
                    <span className="h-2.5 overflow-hidden rounded-full bg-accent/10">
                      <span
                        className={`block h-full rounded-full ${lead ? 'bg-accent' : 'bg-accent/40'}`}
                        style={{ width: `${Math.round((item.quantite / maxItem) * 100)}%`, transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }}
                      />
                    </span>
                  </li>
                );
              })}
              {(totals?.items.length ?? 0) === 0 && <li className="text-[14px] text-muted">Aucune commande aujourd'hui.</li>}
            </ul>
            <p className="mt-4 text-[13px] text-ink-soft">{plural(totals?.total ?? 0, 'portion')} au total aujourd'hui</p>
          </section>

          <LinkButton to="/admin/suivi" variant="soft" icon="clipboard" className="a-rise d5 mt-2">
            Détail client par client
          </LinkButton>
        </div>
      )}
    </AdminPage>
  );
}
