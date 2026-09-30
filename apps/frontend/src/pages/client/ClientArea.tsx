/**
 * Espace client : charge le menu du jour et l'historique une fois pour les trois onglets
 * (Menu, Historique, Compte), et affiche la barre de navigation du bas avec ses pastilles.
 */

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ClientDailyMenuView, ClientHistoryEntry } from '@meal-app/shared';
import { clientApi } from '../../api/endpoints';
import { useApi, usePolling, type ApiState } from '../../hooks/useApi';
import { FORMULE_LABEL } from '../../lib/format';
import { useAuth } from '../../features/auth/AuthContext';

interface ClientAreaValue {
  menu: ApiState<ClientDailyMenuView>;
  history: ApiState<ClientHistoryEntry[]>;
  /** Recharge le menu et l'historique après une action (commande, avis…) */
  refreshAll: () => Promise<void>;
}

const ClientAreaContext = createContext<ClientAreaValue | null>(null);

export function useClientArea(): ClientAreaValue {
  const context = useContext(ClientAreaContext);
  if (!context) throw new Error('useClientArea doit être utilisé dans ClientArea');
  return context;
}

/** Le client a-t-il encore un choix à faire aujourd'hui ? */
function hasPendingChoice(menu: ClientDailyMenuView | null): boolean {
  if (!menu?.dailyOffer) return false;
  if (menu.etatAbonnement === 'expire' || menu.etatAbonnement === 'non_commence') return false;
  if (menu.statutMenu === 'verrouille' || menu.statutMenu === 'aucun_menu') return false;
  return !menu.commandeExistante;
}

const NAV_ITEMS = [
  { to: '/menu', label: 'Menu' },
  { to: '/historique', label: 'Historique' },
  { to: '/compte', label: 'Compte' },
] as const;

function BottomNav({ badges }: { badges: Record<string, number> }) {
  const location = useLocation();
  const activeIndex = Math.max(0, NAV_ITEMS.findIndex((item) => location.pathname.startsWith(item.to)));

  return (
    <div className="a-nav pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <nav
        aria-label="Navigation principale"
        className="pointer-events-auto relative grid w-full max-w-[358px] grid-cols-3 gap-0.5 rounded-full bg-surface p-1.5 shadow-nav"
      >
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 top-1.5 rounded-full bg-nav-pill transition-[left] duration-500 [transition-timing-function:cubic-bezier(.3,.8,.3,1)]"
          style={{ width: 'calc((100% - 12px - 4px) / 3)', left: `calc(6px + ${activeIndex} * ((100% - 12px - 4px) / 3 + 2px))` }}
        />
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative z-[1] flex h-11 items-center justify-center rounded-full text-sm font-bold tracking-[0.01em] transition-colors ${
                isActive ? 'text-nav-ink' : 'text-ink hover:text-accent'
              }`
            }
          >
            {item.label}
            {(badges[item.to] ?? 0) > 0 && (
              <span
                aria-label={`${badges[item.to]} en attente`}
                className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-nav-ink text-[12px] font-bold text-white dark:bg-ink dark:text-page"
              >
                {badges[item.to]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function ClientArea() {
  const menu = useApi(() => clientApi.todayMenu(), []);
  const history = useApi(() => clientApi.history(), []);

  // Le menu évolue au fil de la journée (heure limite, verrouillage de 20h) : relecture régulière
  usePolling(() => void menu.reload(true), 60_000);

  const refreshAll = useCallback(async () => {
    await Promise.all([menu.reload(true), history.reload(true)]);
  }, [menu, history]);

  const badges = useMemo(
    () => ({
      '/menu': hasPendingChoice(menu.data) ? 1 : 0,
      '/historique': (history.data ?? []).filter((entry) => entry.avisPossible).length,
    }),
    [menu.data, history.data]
  );

  const value = useMemo(() => ({ menu, history, refreshAll }), [menu, history, refreshAll]);

  return (
    <ClientAreaContext.Provider value={value}>
      <div className="min-h-screen bg-page">
        <div className="relative mx-auto min-h-screen w-full max-w-[480px] bg-page lg:shadow-[0_0_0_1px_rgb(var(--c-line)/0.06)]">
          <Outlet />
        </div>
        <BottomNav badges={badges} />
      </div>
    </ClientAreaContext.Provider>
  );
}

/**
 * Coque d'un onglet client : photo floutée en haut, titre serif, pastille de formule,
 * puis feuille blanche arrondie qui défile.
 */
export function ClientShell({
  title,
  photo,
  center,
  children,
}: {
  title: string;
  photo: string;
  center?: ReactNode;
  children: ReactNode;
}) {
  const { subscription } = useAuth();
  const { menu } = useClientArea();
  const formule = menu.data?.formule ?? subscription?.formule;

  return (
    <div className="relative">
      <div aria-hidden="true" className="a-fade pointer-events-none absolute inset-x-0 top-0 h-[210px] overflow-hidden">
        <img src={photo} alt="" className="h-full w-full object-cover object-[50%_45%]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(var(--c-page)/0.5)_0%,rgb(var(--c-page)/0.8)_55%,rgb(var(--c-page))_100%)]" />
      </div>
      <header className="relative z-10 flex h-16 items-center justify-between px-5">
        <span className="font-serif text-[42px] leading-none tracking-[-0.01em] text-accent">{title}</span>
        {center}
        {formule && (
          <span className="rounded-full bg-surface/80 px-3 pb-1.5 pt-[5px] font-serif text-[17px] italic leading-none tracking-[0.02em] text-accent backdrop-blur-md">
            {FORMULE_LABEL[formule]}
          </span>
        )}
      </header>
      <main className="a-sheet relative z-[1] mt-12 min-h-[calc(100vh-112px)] rounded-t-5xl border-t border-white/90 bg-surface px-5 pb-32 pt-3 shadow-[0_-12px_40px_rgb(var(--c-shadow)/0.08)] dark:border-white/5">
        {children}
      </main>
    </div>
  );
}
