/**
 * Espace administratrice (SPEC 6) :
 * - sur téléphone, barre d'onglets en bas avec le bouton « + » d'actions rapides (maquette) ;
 * - dès 1024 px, barre latérale toujours visible, mêmes écrans.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import { useApi, usePolling } from '../../hooks/useApi';
import { Icon, type IconName } from '../../components/ui/Icon';
import { Logo } from '../../components/ui/Controls';

const SEEN_KEY = 'yf-avis-vus';

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

interface AdminAreaValue {
  newReviews: number;
  markReviewsSeen: () => void;
}

const AdminAreaContext = createContext<AdminAreaValue | null>(null);

export function useAdminArea(): AdminAreaValue {
  const context = useContext(AdminAreaContext);
  if (!context) throw new Error('useAdminArea doit être utilisé dans AdminArea');
  return context;
}

export const QUICK_ACTIONS: { label: string; icon: IconName; to: string }[] = [
  { label: 'Ajouter un plat', icon: 'dish', to: '/admin/carte?nouveau=1' },
  { label: 'Publier un menu', icon: 'calendar', to: '/admin/menus' },
  { label: 'Nouveau client', icon: 'user', to: '/admin/clients?nouveau=1' },
];

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/admin', label: 'Accueil', icon: 'home', end: true },
  { to: '/admin/suivi', label: 'Suivi', icon: 'clipboard' },
  { to: '/admin/clients', label: 'Clients', icon: 'users' },
  { to: '/admin/carte', label: 'Carte', icon: 'dish' },
  { to: '/admin/menus', label: 'Menus', icon: 'calendar' },
  { to: '/admin/avis', label: 'Avis', icon: 'star' },
];

function Badge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} nouveaux avis`}
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-nav-ink px-1 text-[10px] font-bold leading-none text-white dark:bg-ink dark:text-page ${className ?? ''}`}
    >
      {count}
    </span>
  );
}

function MobileNav({ newReviews }: { newReviews: number }) {
  const [fabOpen, setFabOpen] = useState(false);
  const navigate = useNavigate();
  const left = NAV.slice(0, 3);
  const right = NAV.slice(3);

  const link = (item: (typeof NAV)[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `relative flex h-11 min-w-0 flex-1 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
          isActive ? 'bg-nav-pill text-nav-ink' : 'text-ink hover:text-accent'
        }`
      }
    >
      {item.label}
      {item.to === '/admin/avis' && <Badge count={newReviews} className="absolute right-0 top-0.5" />}
    </NavLink>
  );

  return (
    <>
      {fabOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Fermer le menu" onClick={() => setFabOpen(false)} className="a-fade absolute inset-0 bg-[rgb(var(--c-overlay)/0.35)] backdrop-blur-[3px]" />
          <div role="menu" className="absolute inset-x-0 bottom-[104px] flex flex-col items-center gap-2.5">
            {QUICK_ACTIONS.map((action, index) => (
              <button
                key={action.to}
                type="button"
                role="menuitem"
                onClick={() => {
                  setFabOpen(false);
                  navigate(action.to);
                }}
                style={{ animationDelay: `${(QUICK_ACTIONS.length - index) * 0.05}s` }}
                className="a-rise press flex h-[52px] w-[186px] items-center gap-3 rounded-full bg-surface pl-2 pr-5 text-[14px] font-semibold text-ink shadow-nav"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Icon name={action.icon} size={18} />
                </span>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="a-nav pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-3 lg:hidden">
        <nav aria-label="Navigation principale" className="pointer-events-auto flex w-full max-w-[372px] items-center rounded-full bg-surface p-[7px] shadow-nav">
          {left.map(link)}
          <button
            type="button"
            aria-label="Actions rapides"
            aria-haspopup="menu"
            aria-expanded={fabOpen}
            onClick={() => setFabOpen((v) => !v)}
            className="flex h-11 w-16 flex-none items-center justify-center"
          >
            <span
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-accent text-on-accent shadow-fab transition-transform duration-300 [transition-timing-function:cubic-bezier(.3,1.3,.5,1)]"
              style={{ transform: fabOpen ? 'rotate(45deg)' : 'none' }}
            >
              <Icon name="plus" size={22} strokeWidth={2.2} />
            </span>
          </button>
          {right.map(link)}
        </nav>
      </div>
    </>
  );
}

function Sidebar({ newReviews }: { newReviews: number }) {
  const navigate = useNavigate();
  const item = (to: string, label: string, icon: IconName, end = false, badge = 0) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) =>
        `press flex h-11 items-center gap-3 rounded-full px-4 text-[14px] font-semibold ${
          isActive ? 'bg-nav-pill text-nav-ink' : 'text-ink-soft hover:bg-ink/[0.04] hover:text-ink'
        }`
      }
    >
      <Icon name={icon} size={18} />
      <span className="flex-1">{label}</span>
      <Badge count={badge} />
    </NavLink>
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col gap-6 border-r border-line/[0.06] bg-surface px-4 py-6 lg:flex">
      <Link to="/admin" className="flex items-center gap-3 px-2">
        <Logo height={52} />
        <span className="font-serif text-[17px] italic text-accent">Espace admin</span>
      </Link>
      <nav aria-label="Navigation principale" className="flex flex-col gap-1">
        {NAV.map((entry) => item(entry.to, entry.label, entry.icon, entry.end, entry.to === '/admin/avis' ? newReviews : 0))}
        {item('/admin/statistiques', 'Statistiques', 'chart')}
      </nav>
      <div className="flex flex-col gap-2">
        <span className="px-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Actions rapides</span>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.to}
            type="button"
            onClick={() => navigate(action.to)}
            className="press flex h-11 items-center gap-3 rounded-full bg-field px-4 text-[14px] font-semibold text-accent-strong"
          >
            <Icon name={action.icon} size={18} />
            {action.label}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      {item('/admin/compte', 'Mon compte', 'user')}
    </aside>
  );
}

export function AdminArea() {
  const location = useLocation();
  const [seen, setSeen] = useState(readSeen);
  const reviews = useApi(() => adminApi.reviews(), []);
  usePolling(() => void reviews.reload(true), 60_000);

  const newReviews = useMemo(
    () => (reviews.data ?? []).filter((review) => review.createdAt > seen).length,
    [reviews.data, seen]
  );

  const markReviewsSeen = useCallback(() => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(SEEN_KEY, now);
    } catch {
      // Stockage indisponible : la pastille se recalculera au prochain chargement
    }
    setSeen(now);
  }, []);

  const value = useMemo(() => ({ newReviews, markReviewsSeen }), [newReviews, markReviewsSeen]);

  return (
    <AdminAreaContext.Provider value={value}>
      <div className="min-h-screen bg-page">
        <Sidebar newReviews={newReviews} />
        <div key={location.pathname} className="lg:pl-[264px]">
          <Outlet />
        </div>
        <MobileNav newReviews={newReviews} />
      </div>
    </AdminAreaContext.Provider>
  );
}

/** Coque d'une page admin : retour éventuel, grand titre serif, sous-titre, actions */
export function AdminPage({
  title,
  subtitle,
  back,
  aside,
  children,
  wide = false,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  aside?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className={`mx-auto w-full px-5 pb-36 pt-6 lg:px-10 lg:pb-16 lg:pt-10 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
      {(back || aside) && (
        <div className="mb-4 flex items-center justify-between">
          {back ? (
            <Link to={back} aria-label="Retour" className="press flex h-11 w-11 items-center justify-center rounded-full bg-field text-accent-strong">
              <Icon name="chevronLeft" />
            </Link>
          ) : (
            <span />
          )}
          {aside}
        </div>
      )}
      {title && (
        <h1 className="a-rise d1 font-serif text-[42px] leading-[1.05] tracking-[-0.01em] text-ink [text-wrap:balance]">{title}</h1>
      )}
      {subtitle && <div className="a-rise d2 mt-1.5 text-[14px] leading-[1.45] text-ink-soft">{subtitle}</div>}
      <div className={title ? 'mt-6' : ''}>{children}</div>
    </main>
  );
}
