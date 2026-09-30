/**
 * « Suivi du jour » (SPEC 5.10 & 6) : vue en direct des choix, rafraîchie toutes les 15 secondes,
 * case « préparé », réglage de l'heure limite du jour ; liste finale verrouillée après 20h00.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DailyOfferStatus, LOCK_TIME, type ClientOrderDetailRow, type LivePreparationSummary } from '@meal-app/shared';
import { adminApi } from '../../api/endpoints';
import { useApi, usePolling, useTicker } from '../../hooks/useApi';
import { AdminPage } from './AdminArea';
import { Avatar, Chips } from '../../components/ui/Controls';
import { Icon } from '../../components/ui/Icon';
import { Button, IconButton, LinkButton } from '../../components/ui/Button';
import { Sheet, SheetActions } from '../../components/ui/Sheet';
import { EmptyState, ErrorState, FormError, Notice, SectionLoader } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { ApiError } from '../../api/client';
import { normalizeSearch } from '../../lib/search';
import {
  FORMULE_LABEL,
  formatCountdown,
  formatTime,
  initials,
  kinshasaClock,
  timeToSeconds,
  todayKinshasa,
} from '../../lib/format';

const POLL_MS = 15_000;

type Filter = 'tous' | 'a_preparer' | 'prepares' | 'attente';

interface Row {
  key: string;
  orderId: number | null;
  prenom: string;
  nom: string;
  formule: string;
  origin: 'choisi' | 'automatique' | 'en attente';
  dishes: string;
  prepared: boolean;
}

function dishesOf(row: ClientOrderDetailRow): string {
  return [row.platNom, row.accompagnementNom, row.viandeNom ?? 'sans viande'].filter(Boolean).join(' · ');
}

function toRows(summary: LivePreparationSummary): Row[] {
  const orders: Row[] = summary.commandesDetaillees.map((row) => ({
    key: `c-${row.orderId}`,
    orderId: row.orderId,
    prenom: row.clientPrenom,
    nom: row.clientNom,
    formule: FORMULE_LABEL[row.formule],
    origin: row.origine === 'automatique' ? 'automatique' : 'choisi',
    dishes: dishesOf(row),
    prepared: row.prepare,
  }));
  const waiting: Row[] = summary.clientsEnAttente.map((row) => ({
    key: `a-${row.subscriptionId}`,
    orderId: null,
    prenom: row.clientPrenom,
    nom: row.clientNom,
    formule: FORMULE_LABEL[row.formule],
    origin: 'en attente',
    dishes: `Choix automatique à ${formatTime(LOCK_TIME)} si rien d'ici là`,
    prepared: false,
  }));
  return [...orders, ...waiting].sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'));
}

function DeadlineSheet({
  open,
  onClose,
  current,
  date,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  current: string;
  date: string;
  onSaved: () => void;
}) {
  const [minutes, setMinutes] = useState(timeToSeconds(current) / 60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) setMinutes(timeToSeconds(current) / 60);
  }, [open, current]);

  const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateOffer(date, { heureLimiteIndicative: label });
      toast.show(`Heure limite : ${formatTime(label)}`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Heure limite" subtitle="Fixe la limite indicative du jour. Après elle, les clients peuvent encore choisir, en retard.">
      <span className="mb-2 ml-1.5 text-[13px] font-semibold text-ink-soft">Limite normale</span>
      <div className="flex h-[52px] items-center gap-3 rounded-full bg-field pl-[22px] pr-2 text-field-ink">
        <Icon name="clock" />
        <span className="flex-1 text-base text-ink">Avant</span>
        <IconButton icon="minus" label="Trente minutes plus tôt" variant="surface" size={34} disabled={minutes <= 11 * 60} onClick={() => setMinutes((m) => m - 30)} />
        <span className="w-14 text-center text-base font-bold tabular-nums text-ink">{formatTime(label)}</span>
        <IconButton icon="plus" label="Trente minutes plus tard" variant="surface" size={34} disabled={minutes >= 19 * 60} onClick={() => setMinutes((m) => m + 30)} />
      </div>
      <p className="ml-1.5 mt-1.5 text-[12px] text-muted">Verrouillage définitif à 20h00.</p>
      <div className="mt-2">
        <FormError>{error}</FormError>
      </div>
      <SheetActions>
        <Button onClick={save} loading={saving} icon="check">
          Enregistrer
        </Button>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
      </SheetActions>
    </Sheet>
  );
}

export function TrackingPage() {
  const today = todayKinshasa();
  const [params, setParams] = useSearchParams();
  const live = useApi(() => adminApi.live(), []);
  const [lastUpdate, setLastUpdate] = useState(() => Date.now());
  const now = useTicker();
  const [filter, setFilter] = useState<Filter>('tous');
  const [search, setSearch] = useState('');
  const [prepared, setPrepared] = useState<Record<number, boolean>>({});
  const deadlineOpen = params.get('heure') === '1';

  useEffect(() => {
    if (live.data) {
      setLastUpdate(Date.now());
      setPrepared({});
    }
  }, [live.data]);

  usePolling(() => void live.reload(true), POLL_MS);

  const summary = live.data;
  const locked = summary?.statutOffre === DailyOfferStatus.VERROUILLE;

  const rows = useMemo(
    () => (summary ? toRows(summary).map((row) => (row.orderId && row.orderId in prepared ? { ...row, prepared: prepared[row.orderId] as boolean } : row)) : []),
    [summary, prepared]
  );

  if (live.loading && !summary) {
    return (
      <AdminPage title="La cuisine s'organise.">
        <SectionLoader />
      </AdminPage>
    );
  }

  if (!summary) {
    const noMenu = live.error?.status === 404;
    return (
      <AdminPage title="La cuisine s'organise.">
        {noMenu ? (
          <EmptyState icon="calendar" title="Pas de menu aujourd'hui">
            <p>Aucun menu n'est publié pour aujourd'hui : il n'y a rien à préparer.</p>
            <div className="mt-4">
              <LinkButton to="/admin/menus" size="md" icon="plus">
                Publier un menu
              </LinkButton>
            </div>
          </EmptyState>
        ) : (
          <ErrorState message={live.error?.message ?? 'Suivi indisponible.'} onRetry={() => void live.reload()} />
        )}
      </AdminPage>
    );
  }

  const clock = kinshasaClock(new Date(now));
  const target = timeToSeconds(clock.seconds < timeToSeconds(summary.heureLimiteIndicative) ? summary.heureLimiteIndicative : LOCK_TIME);
  const countdown = locked || clock.date !== today ? '--:--:--' : formatCountdown(target - clock.seconds);
  const age = Math.max(0, Math.round((now - lastUpdate) / 1000));

  const orderRows = rows.filter((row) => row.orderId !== null);
  const preparedCount = orderRows.filter((row) => row.prepared).length;
  const waitingCount = rows.length - orderRows.length;
  const defaultCount = orderRows.filter((row) => row.origin === 'automatique').length;
  const query = normalizeSearch(search);

  const visible = rows.filter((row) => {
    if (query && !normalizeSearch(`${row.prenom} ${row.nom}`).includes(query)) return false;
    if (filter === 'a_preparer') return row.orderId !== null && !row.prepared;
    if (filter === 'prepares') return row.prepared;
    if (filter === 'attente') return row.orderId === null;
    return true;
  });

  const filters: { value: Filter; label: string; count?: number }[] = [
    { value: 'tous', label: 'Tous', count: rows.length },
    { value: 'a_preparer', label: 'À préparer', count: orderRows.length - preparedCount },
    { value: 'prepares', label: 'Préparés', count: preparedCount },
    ...(locked ? [] : [{ value: 'attente' as const, label: 'En attente', count: waitingCount }]),
  ];

  const togglePrepared = async (row: Row) => {
    if (!row.orderId) return;
    const next = !row.prepared;
    setPrepared((current) => ({ ...current, [row.orderId as number]: next }));
    try {
      await adminApi.setPrepared(row.orderId, next);
    } catch {
      setPrepared((current) => ({ ...current, [row.orderId as number]: !next }));
    }
  };

  const percent = orderRows.length ? Math.round((preparedCount / orderRows.length) * 100) : 0;

  return (
    <AdminPage
      aside={
        <span className="font-serif text-[22px] tabular-nums text-ink" role="timer" aria-label="Temps restant">
          {countdown}
        </span>
      }
      back={undefined}
      title={locked ? 'Tout est bouclé.' : "La cuisine s'organise."}
      subtitle={
        locked ? undefined : (
          <>
            Heure limite indicative {formatTime(summary.heureLimiteIndicative)} · verrouillage à 20h00. Actualisé il y a {age} s.
          </>
        )
      }
    >
      {locked && (
        <div className="a-rise d2 mb-4">
          <Notice icon="lock">
            Liste finale depuis 20h00.{' '}
            {defaultCount > 0
              ? `${defaultCount === 1 ? 'Le client sans choix a reçu' : `Les ${defaultCount} clients sans choix ont reçu`} le menu le plus demandé.`
              : 'Tous les clients avaient choisi.'}
            {summary.clientsAnnules > 0 ? ` ${summary.clientsAnnules} repas annulé${summary.clientsAnnules > 1 ? 's' : ''}.` : ''}
          </Notice>
        </div>
      )}

      <div className="a-rise d2 flex items-center gap-3">
        <span className="text-[13px] text-ink-soft">
          <strong className="text-ink">{preparedCount}</strong> préparés sur {orderRows.length}
        </span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
          <span className="block h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${percent}%` }} />
        </span>
        {!locked && (
          <button type="button" onClick={() => setParams({ heure: '1' })} className="press flex h-9 items-center gap-1.5 rounded-full bg-field px-3 text-[13px] font-semibold text-accent-strong">
            <Icon name="clock" size={16} />
            {formatTime(summary.heureLimiteIndicative)}
          </button>
        )}
      </div>
      {!locked && summary.clientsAnnules > 0 && (
        <p className="mt-2 text-[13px] text-danger">
          {summary.clientsAnnules} client{summary.clientsAnnules > 1 ? 's ont' : ' a'} annulé : pas de livraison.
        </p>
      )}

      <label className="a-rise d3 mt-4 flex h-12 items-center gap-3 rounded-full bg-field px-5 text-field-ink focus-within:bg-field-focus">
        <Icon name="search" />
        <input
          type="search"
          placeholder="Retrouver un client…"
          aria-label="Retrouver un client"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none"
        />
      </label>

      <Chips className="a-rise d3 mt-3" options={filters} value={filter} onChange={setFilter} label="Filtrer les repas" />

      <ul className="a-rise d4 mt-3 flex flex-col">
        {visible.map((row) => {
          const originColor = row.origin === 'choisi' ? 'text-accent-strong' : row.origin === 'automatique' ? 'text-muted' : 'text-warn';
          return (
            <li key={row.key} className="flex items-center gap-3 border-b border-line/[0.06] py-3 last:border-0">
              <Avatar text={initials(row.prenom, row.nom)} size={42} />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-semibold text-ink">
                    {row.prenom} {row.nom}
                  </span>
                  <span className={`flex-none font-serif text-[14px] italic ${originColor}`}>{row.origin}</span>
                </div>
                <span className={`text-[13px] leading-snug ${row.orderId ? 'text-ink-soft' : 'text-muted'}`}>{row.dishes}</span>
                <span className="text-[12px] text-muted">{row.formule}</span>
              </div>
              <button
                type="button"
                disabled={!row.orderId}
                onClick={() => void togglePrepared(row)}
                aria-pressed={row.prepared}
                aria-label={row.prepared ? 'Préparé, appuie pour annuler' : 'Marquer comme préparé'}
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors disabled:opacity-35 ${
                  row.prepared ? 'a-pop bg-accent text-on-accent' : 'border-[1.5px] border-ink/25'
                }`}
              >
                {row.prepared && <Icon name="check" size={18} strokeWidth={2.4} />}
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="py-10 text-center text-[14px] text-muted">Personne dans cette liste.</li>}
      </ul>

      <DeadlineSheet
        open={deadlineOpen && !locked}
        onClose={() => setParams({})}
        current={summary.heureLimiteIndicative}
        date={summary.date}
        onSaved={() => void live.reload(true)}
      />
    </AdminPage>
  );
}
