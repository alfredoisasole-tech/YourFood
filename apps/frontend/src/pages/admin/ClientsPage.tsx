/**
 * « Tous tes habitués. » (SPEC 6) : liste des clients, état coloré, recherche et filtres.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ClientListFilter, SubscriptionState } from '@meal-app/shared';
import { adminApi } from '../../api/endpoints';
import { useApi } from '../../hooks/useApi';
import { AdminPage } from './AdminArea';
import { NewClientSheet } from './NewClientSheet';
import { Avatar, Chips } from '../../components/ui/Controls';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { EmptyState, ErrorState, SectionLoader } from '../../components/ui/States';
import { formatPhone, initials, plural } from '../../lib/format';

type Filter = 'tous' | ClientListFilter;

export const STATE_LABEL: Record<SubscriptionState, { text: string; className: string }> = {
  actif: { text: 'actif', className: 'text-accent-strong' },
  bientot_expire: { text: 'bientôt expiré', className: 'text-warn' },
  expire: { text: 'expiré', className: 'text-danger' },
  non_commence: { text: 'à venir', className: 'text-muted' },
};

export function ClientsPage() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('tous');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const list = useApi(
    () => adminApi.listClients({ q: query || undefined, etat: filter === 'tous' ? undefined : filter }),
    [query, filter]
  );

  const counts = list.data?.compteurs;
  const filters: { value: Filter; label: string; count?: number }[] = [
    { value: 'tous', label: 'Tous', count: counts?.tous },
    { value: 'actif', label: 'Actifs', count: counts?.actifs },
    { value: 'bientot_expire', label: 'Bientôt expirés', count: counts?.bientotExpires },
    { value: 'expire', label: 'Expirés', count: counts?.expires },
  ];

  const clients = list.data?.clients ?? [];

  return (
    <AdminPage title="Tous tes habitués.">
      <Button icon="plus" onClick={() => setParams({ nouveau: '1' })} className="a-rise d2">
        Nouveau client
      </Button>

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

      <Chips className="a-rise d3 mt-3" options={filters} value={filter} onChange={setFilter} label="Filtrer les clients" />

      <div className="mt-3">
        {list.loading && !list.data ? (
          <SectionLoader />
        ) : list.error ? (
          <ErrorState message={list.error.message} onRetry={() => void list.reload()} />
        ) : clients.length === 0 ? (
          <EmptyState icon="users" title={query || filter !== 'tous' ? 'Personne ici' : 'Pas encore de client'}>
            {query || filter !== 'tous' ? 'Essaie un autre nom ou un autre filtre.' : 'Inscris ton premier client pour commencer.'}
          </EmptyState>
        ) : (
          <>
            <ul className="a-rise d4 flex flex-col">
              {clients.map((client) => {
                const state = client.etat ? STATE_LABEL[client.etat] : null;
                return (
                  <li key={client.id}>
                    <Link to={`/admin/clients/${client.id}`} className="-mx-2 flex items-center gap-3 rounded-3xl px-2 py-2.5 transition-colors hover:bg-accent/[0.06]">
                      <Avatar text={initials(client.prenom, client.nom)} size={44} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-semibold text-ink">
                          {client.prenom} {client.nom}
                        </span>
                        <span className="text-[13px] text-muted">{client.telephone ? formatPhone(client.telephone) : 'Pas de numéro'}</span>
                      </span>
                      {state && <span className={`text-[12px] font-medium ${state.className}`}>{state.text}</span>}
                      <Icon name="chevronRight" size={18} className="text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-center text-[13px] text-muted">
              {plural(clients.length, 'affiché', 'affichés')}
              {counts && filter === 'tous' && !query ? '' : ` sur ${counts?.tous ?? clients.length}`}
            </p>
          </>
        )}
      </div>

      <NewClientSheet open={params.get('nouveau') === '1'} onClose={() => setParams({})} onCreated={() => void list.reload(true)} />
    </AdminPage>
  );
}
