/**
 * Fiche client détaillée (SPEC 6) : bandeau, actions, onglets Infos · Historique · Avis.
 */

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { OrderStatus, WEEKLY_PRICE_FC, countWorkingDays, isMeatIncluded } from '@meal-app/shared';
import { adminApi } from '../../api/endpoints';
import { useApi } from '../../hooks/useApi';
import { AdminPage } from './AdminArea';
import { STATE_LABEL } from './ClientsPage';
import { AccessSheet, EditClientSheet, RenewSheet, type AccessMode } from './ClientSheets';
import { Avatar, Chips, SectionTitle, Stars } from '../../components/ui/Controls';
import { Button, IconButton } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { PriceBadge, ReadonlyField } from '../../components/ui/Field';
import { EmptyState, ErrorState, SectionLoader } from '../../components/ui/States';
import { HistoryList } from '../../components/history/HistoryList';
import { useToast } from '../../components/ui/Toast';
import { normalizeSearch } from '../../lib/search';
import {
  FORMULE_DESCRIPTION,
  FORMULE_LABEL,
  capitalize,
  formatFc,
  formatFullDate,
  formatPeriod,
  formatPhone,
  formatShortDate,
  initials,
  plural,
  todayKinshasa,
} from '../../lib/format';

type Tab = 'infos' | 'historique' | 'avis';

export function ClientDetailPage() {
  const id = Number(useParams().id);
  const today = todayKinshasa();
  const toast = useToast();
  const detail = useApi(() => adminApi.clientDetail(id), [id]);
  const [tab, setTab] = useState<Tab>('infos');
  const [renewOpen, setRenewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [accessMode, setAccessMode] = useState<AccessMode | null>(null);
  const [search, setSearch] = useState('');

  const data = detail.data;
  const rows = useMemo(() => {
    const query = normalizeSearch(search);
    return (data?.historiqueJours ?? [])
      .filter((row) => row.date <= today)
      .filter((row) => !query || normalizeSearch([row.platNom, row.accompagnementNom, row.viandeNom].join(' ')).includes(query));
  }, [data, search, today]);

  if (detail.loading && !data) {
    return (
      <AdminPage back="/admin/clients">
        <SectionLoader />
      </AdminPage>
    );
  }
  if (!data) {
    return (
      <AdminPage back="/admin/clients">
        <ErrorState message={detail.error?.message ?? 'Client introuvable.'} onRetry={() => void detail.reload()} />
      </AdminPage>
    );
  }

  const client = data.client;
  const sub = data.abonnementCourant;
  const state = sub ? STATE_LABEL[sub.etat] : null;
  const total = sub ? countWorkingDays(sub.dateDebut, sub.dateFin) : 0;
  const elapsed = sub ? Math.max(0, Math.min(100, ((total - sub.joursRestants) / Math.max(1, total)) * 100)) : 0;
  const pastPeriods = data.historiqueAbonnements.filter((period) => period.id !== sub?.id);
  const meatNote = sub && FORMULE_DESCRIPTION[sub.formule];

  return (
    <AdminPage
      back="/admin/clients"
      aside={<IconButton icon="pencil" label="Modifier la fiche" onClick={() => setEditOpen(true)} />}
    >
      <div className="a-rise d1 flex items-center gap-4">
        <Avatar text={initials(client.prenom, client.nom)} size={64} className="text-[22px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="font-serif text-[32px] leading-[1.05] tracking-[-0.01em] text-ink">
            {client.prenom} {client.nom}
          </h1>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[14px] text-ink-soft">
              <Icon name="phone" size={15} />
              {client.telephone ? formatPhone(client.telephone) : 'Pas de numéro'}
            </span>
            {state && <span className={`rounded-full bg-field px-2.5 py-1 text-[12px] font-semibold ${state.className}`}>{capitalize(state.text)}</span>}
          </div>
        </div>
      </div>

      {sub && (
        <div className="a-rise d2 mt-5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-field px-3 py-1 text-[12px] font-semibold text-accent-strong">{FORMULE_LABEL[sub.formule]}</span>
            <span className="text-[13px] text-ink-soft">
              {sub.etat === 'expire'
                ? 'Terminé'
                : sub.etat === 'non_commence'
                  ? `Commence le ${formatShortDate(sub.dateDebut)}`
                  : plural(sub.joursRestants, 'jour restant', 'jours restants')}
            </span>
          </div>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-ink/10">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${elapsed}%` }} />
          </span>
          <p className="mt-2 text-[13px] text-ink-soft">
            Du {formatFullDate(sub.dateDebut).replace(/ \d{4}$/, '')} au {formatFullDate(sub.dateFin).replace(/ \d{4}$/, '')}
          </p>
        </div>
      )}

      <div className="a-rise d3 mt-5 flex flex-col gap-2.5">
        <Button icon="refresh" onClick={() => setRenewOpen(true)} disabled={!sub}>
          Renouveler / prolonger
        </Button>
        <Button variant="soft" size="md" icon="message" onClick={() => setAccessMode('bienvenue')}>
          Renvoyer le message de bienvenue
        </Button>
        <Button variant="soft" size="md" icon="key" onClick={() => setAccessMode('reinitialisation')} disabled={!sub}>
          Réinitialiser le mot de passe
        </Button>
      </div>

      <Chips
        className="a-rise d4 mt-6"
        label="Sections de la fiche"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'infos', label: 'Infos' },
          { value: 'historique', label: 'Historique' },
          { value: 'avis', label: 'Avis', count: data.avis.length },
        ]}
      />

      <div className="mt-4">
        {tab === 'infos' && (
          <div className="flex flex-col gap-4">
            {sub ? (
              <>
                <ReadonlyField label="Formule" icon="dish" badge={<PriceBadge>{formatFc(WEEKLY_PRICE_FC[sub.formule])} / sem.</PriceBadge>} hint={meatNote}>
                  {FORMULE_LABEL[sub.formule]}
                </ReadonlyField>
                <ReadonlyField label="Durée" icon="calendar">
                  {plural(sub.dureeSemaines, 'semaine')}
                </ReadonlyField>
                <ReadonlyField label="Période" icon="flag">
                  {formatPeriod(sub.dateDebut, sub.dateFin)}
                </ReadonlyField>
                <ReadonlyField label="Total" icon="star" badge={<PriceBadge>{formatFc(sub.totalFc)}</PriceBadge>}>
                  {sub.dureeSemaines} × {formatFc(WEEKLY_PRICE_FC[sub.formule])}
                </ReadonlyField>
                <ReadonlyField label="Bonus" icon="star">
                  {sub.bonus || 'Aucun'}
                </ReadonlyField>
                {isMeatIncluded(sub.formule, today) === false && sub.etat !== 'expire' && (
                  <p className="-mt-2 ml-1.5 text-[12px] text-muted">Pas de viande aujourd'hui avec cette formule.</p>
                )}
              </>
            ) : (
              <EmptyState icon="calendar" title="Aucun abonnement" />
            )}
            {pastPeriods.length > 0 && (
              <div className="mt-2">
                <SectionTitle className="mb-2">Autres périodes</SectionTitle>
                <ul className="flex flex-col">
                  {pastPeriods.map((period) => (
                    <li key={period.id} className="flex items-center justify-between border-b border-line/[0.06] py-3 text-[14px] last:border-0">
                      <span className="text-ink">{formatPeriod(period.dateDebut, period.dateFin)}</span>
                      <span className="text-ink-soft">
                        {FORMULE_LABEL[period.formule]} · {formatFc(period.totalFc)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'historique' && (
          <div className="flex flex-col gap-4">
            <label className="flex h-12 items-center gap-3 rounded-full border border-line/[0.1] bg-surface px-5 text-ink-soft">
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
            {rows.length > 0 ? (
              <HistoryList
                audience="admin"
                today={today}
                rows={rows.map((row) => ({ ...row, statut: row.statut as OrderStatus }))}
              />
            ) : (
              <EmptyState icon="calendar" title="Aucun repas">
                {search ? 'Aucun repas ne correspond.' : 'Aucun repas servi pour le moment.'}
              </EmptyState>
            )}
          </div>
        )}

        {tab === 'avis' && (
          <div className="flex flex-col gap-4">
            {data.noteMoyenne !== null && data.noteMoyenne !== undefined && (
              <div className="flex items-center gap-4 rounded-4xl border border-line/[0.08] bg-card px-5 py-4">
                <span className="text-[44px] font-bold leading-none text-accent-strong">{data.noteMoyenne.toLocaleString('fr-FR')}</span>
                <span className="flex flex-col gap-1">
                  <Stars value={Math.round(data.noteMoyenne)} size={18} />
                  <span className="text-[13px] text-ink-soft">Note moyenne sur {plural(data.avis.length, 'avis', 'avis')}</span>
                </span>
              </div>
            )}
            {data.avis.length === 0 ? (
              <EmptyState icon="star" title="Pas encore d'avis" />
            ) : (
              <ul className="flex flex-col">
                {data.avis.map((review) => (
                  <li key={review.orderId} className="flex flex-col gap-1 border-b border-line/[0.06] py-3 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      {review.noteEtoile ? <Stars value={review.noteEtoile} size={14} /> : <span />}
                      <span className="truncate text-[12px] text-muted">
                        {formatShortDate(review.date)} · {review.repas.split(' · ')[0]}
                      </span>
                    </div>
                    {review.commentaire && <p className="text-[15px] leading-snug text-ink">{review.commentaire}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <RenewSheet
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        detail={data}
        onRenewed={(period) => {
          setRenewOpen(false);
          toast.show(`Renouvelé ${formatPeriod(period.dateDebut, period.dateFin).toLowerCase()}`);
          void detail.reload(true);
        }}
      />
      <EditClientSheet open={editOpen} onClose={() => setEditOpen(false)} detail={data} onSaved={() => void detail.reload(true)} />
      <AccessSheet mode={accessMode} onClose={() => setAccessMode(null)} detail={data} />
    </AdminPage>
  );
}
