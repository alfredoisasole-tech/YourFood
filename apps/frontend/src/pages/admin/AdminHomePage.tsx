/**
 * Accueil admin (maquette) : bandeau « Menu de demain », bandeau de la semaine et cartes du jour choisi.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { WeekDayView } from '@meal-app/shared';
import { adminApi } from '../../api/endpoints';
import { useApi } from '../../hooks/useApi';
import { AdminPage } from './AdminArea';
import { Icon } from '../../components/ui/Icon';
import { Ring, SectionTitle } from '../../components/ui/Controls';
import { ErrorState, SectionLoader } from '../../components/ui/States';
import { addDays } from '@meal-app/shared';
import { mondayOf, nextWorkingDay, workingDayFrom } from '../../lib/calendar';
import {
  capitalize,
  dayNumber,
  formatShortDate,
  formatTime,
  formatWeekday,
  formatWeekdayShort,
  initials,
  plural,
  todayKinshasa,
} from '../../lib/format';

const PASTILLES_VISIBLES = 3;

function DayCards({ day, today, activeClients }: { day: WeekDayView; today: string; activeClients: number }) {
  const navigate = useNavigate();
  const offer = day.offre;
  const past = day.date < today;
  const tag = past ? 'Servi' : day.publie ? 'Publié' : 'À publier';
  const limit = past ? 'Terminé' : day.publie ? `Limite ${formatTime(offer?.heureLimiteIndicative ?? '13:00')}` : 'Avant 20h00 la veille';
  const deliveries = day.livraisonsPrevues;
  const percent = activeClients > 0 ? Math.round((deliveries / activeClients) * 100) : 0;

  return (
    <div className="a-rise d4 grid grid-cols-2 grid-rows-[142px_86px] gap-3">
      <Link
        to={`/admin/menus?date=${day.date}`}
        className="press row-span-2 flex min-w-0 flex-col justify-between rounded-4xl bg-peach p-[18px] text-peach-ink"
      >
        <div className="flex flex-col gap-3.5">
          <span className="inline-flex h-6 items-center self-start rounded-full bg-black/10 px-2.5 text-[12px] font-semibold">{tag}</span>
          <span className="font-serif text-[30px] leading-[1.02] tracking-[-0.01em]">Menu du {formatWeekday(day.date)}</span>
          <div className="flex flex-col gap-1 text-[13px] leading-snug opacity-85">
            {offer ? (
              <>
                <span>{plural(offer.plats.length, 'plat')}</span>
                <span>{plural(offer.accompagnements.length, 'accompagnement')}</span>
                <span>{plural(offer.viandes.length, 'viande')}</span>
              </>
            ) : (
              <>
                <span>Aucun plat choisi</span>
                <span>Rien à servir encore</span>
                <span>Les clients attendent</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight">
            <Icon name="clock" size={16} />
            {limit}
          </span>
          <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-peach-ink text-peach">
            <Icon name={day.publie ? 'chevronRight' : 'plus'} size={18} />
          </span>
        </div>
      </Link>

      <Link to={day.date === today ? '/admin/suivi' : `/admin/menus?date=${day.date}`} className="press flex min-w-0 flex-col justify-between rounded-4xl bg-forest px-4 pb-3.5 pt-4 text-white">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <Icon name="dish" size={18} />
          Livraisons
        </span>
        <div className="flex items-end justify-between gap-1.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[30px] font-bold leading-none tabular-nums">{deliveries}</span>
            <span className="text-[12.5px] opacity-85">{past ? 'livrées' : day.date === today ? 'commandes' : 'prévues'}</span>
          </div>
          <Ring percent={percent} size={44} stroke={6} className="text-white" />
        </div>
      </Link>

      <div className="flex items-center justify-around rounded-4xl bg-surface shadow-soft">
        <button type="button" aria-label="Heure limite du jour" onClick={() => navigate('/admin/suivi?heure=1')} className="press flex h-10 w-10 items-center justify-center rounded-full bg-field text-accent-strong">
          <Icon name="clock" size={18} />
        </button>
        <button type="button" aria-label="Suivi du jour" onClick={() => navigate('/admin/suivi')} className="press flex h-10 w-10 items-center justify-center rounded-full bg-field text-accent-strong">
          <Icon name="refresh" size={18} />
        </button>
        <button type="button" aria-label="Menus à venir" onClick={() => navigate('/admin/menus')} className="press flex h-10 w-10 items-center justify-center rounded-full bg-field text-accent-strong">
          <Icon name="calendar" size={18} />
        </button>
      </div>
    </div>
  );
}

export function AdminHomePage() {
  const today = todayKinshasa();
  const monday = mondayOf(today);
  const tomorrow = nextWorkingDay(today);

  const week = useApi(() => adminApi.offers(monday, addDays(monday, 8)), [monday]);
  const clients = useApi(() => adminApi.listClients(), []);
  const [selected, setSelected] = useState(workingDayFrom(today));

  const days = week.data ?? [];
  const selectedDay = days.find((day) => day.date === selected) ?? days[0];
  const tomorrowDay = days.find((day) => day.date === tomorrow);

  const activeClients = useMemo(
    () => (clients.data?.clients ?? []).filter((c) => c.etat === 'actif' || c.etat === 'bientot_expire'),
    [clients.data]
  );
  const pastilles = activeClients.slice(0, PASTILLES_VISIBLES);
  const reste = activeClients.length - pastilles.length;

  const sectionTitle =
    selected === today ? "Aujourd'hui" : selected === tomorrow ? 'Demain' : capitalize(formatShortDate(selected));

  return (
    <AdminPage>
      <div className="a-rise d1 flex items-center justify-between gap-3">
        <Link to="/admin/compte" aria-label="Mon compte" className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-field text-[18px] font-bold text-accent-strong">A</span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[13px] text-muted">Bonjour</span>
            <span className="font-serif text-[26px] leading-[1.05] tracking-[-0.01em] text-ink">Administratrice</span>
          </span>
        </Link>
        <Link to="/admin/statistiques" aria-label="Statistiques" className="press flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-surface text-ink shadow-soft lg:hidden">
          <Icon name="chart" />
        </Link>
      </div>

      <Link
        to={`/admin/menus?date=${tomorrow}`}
        className="a-rise d2 press relative mt-5 block h-[150px] overflow-hidden rounded-4xl bg-[linear-gradient(125deg,rgb(var(--c-accent))_0%,rgb(var(--c-accent-bright))_100%)] text-white dark:bg-[linear-gradient(125deg,#D96A15_0%,#F59A45_100%)]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25"
          style={{
            background: 'radial-gradient(circle, #fff 3px, transparent 3.5px) 0 0 / 22px 22px',
            maskImage: 'linear-gradient(110deg, transparent 35%, #000 100%)',
            WebkitMaskImage: 'linear-gradient(110deg, transparent 35%, #000 100%)',
          }}
        />
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex flex-col gap-1">
            <span className="font-serif text-[32px] leading-[1.05] tracking-[-0.01em]">Menu de demain</span>
            <span className="text-[14px] opacity-90">
              {tomorrowDay?.publie ? `Publié · ${plural(tomorrowDay.livraisonsPrevues, 'livraison prévue', 'livraisons prévues')}` : 'À publier avant 20h00'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center" aria-label={`${activeClients.length} clients actifs`}>
              {pastilles.map((client, index) => (
                <span
                  key={client.id}
                  title={`${client.prenom} ${client.nom}`}
                  className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border-2 border-accent bg-white/90 text-[11px] font-bold text-peach-ink dark:border-[#E07A25] ${index > 0 ? '-ml-2' : ''}`}
                >
                  {initials(client.prenom, client.nom)}
                </span>
              ))}
              {reste > 0 && (
                <span className="-ml-2 flex h-[30px] min-w-[30px] items-center justify-center rounded-full border-2 border-accent bg-white/90 px-1 text-[11px] font-bold text-peach-ink dark:border-[#E07A25]">
                  +{reste}
                </span>
              )}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-peach-ink">
              <Icon name="chevronRight" />
            </span>
          </div>
        </div>
      </Link>

      {week.loading && !week.data ? (
        <SectionLoader />
      ) : week.error ? (
        <ErrorState message={week.error.message} onRetry={() => void week.reload()} />
      ) : (
        <>
          <div role="tablist" aria-label="Jour" className="a-rise d3 no-scrollbar -mx-1 mt-3 flex gap-[5px] overflow-x-auto px-1 py-1">
            {days.map((day) => {
              const on = day.date === selected;
              return (
                <button
                  key={day.date}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={capitalize(formatShortDate(day.date))}
                  onClick={() => setSelected(day.date)}
                  className={`press flex h-[50px] min-w-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full ${
                    on ? 'bg-ink text-page' : 'bg-surface text-ink shadow-soft'
                  }`}
                >
                  <span className="text-[12px] font-medium opacity-75">{formatWeekdayShort(day.date)}</span>
                  <span className="text-[17px] font-bold leading-none tabular-nums">{dayNumber(day.date)}</span>
                </button>
              );
            })}
          </div>

          <SectionTitle className="a-rise d3 mb-3 mt-6">{sectionTitle}</SectionTitle>
          {selectedDay && <DayCards day={selectedDay} today={today} activeClients={activeClients.length} />}
        </>
      )}
    </AdminPage>
  );
}
