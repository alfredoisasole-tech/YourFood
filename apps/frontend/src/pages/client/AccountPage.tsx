/**
 * « Compte » du client : nom, abonnement, mode sombre, mot de passe, déconnexion.
 */

import { useAuth } from '../../features/auth/AuthContext';
import { ClientShell } from './ClientArea';
import { AccountRows } from '../../components/account/AccountRows';
import { FORMULE_LABEL, formatLongDate, fullName, plural } from '../../lib/format';

export function AccountPage() {
  const { user, subscription } = useAuth();

  return (
    <ClientShell title="Compte" photo="/images/photo-accueil.jpg">
      <div className="a-rise d2 mt-6 flex flex-col gap-1">
        <h1 className="font-serif text-[34px] leading-[1.05] tracking-[-0.01em] text-ink">{user ? fullName(user) : ''}</h1>
        {subscription && (
          <p className="text-[14px] text-ink-soft">
            {FORMULE_LABEL[subscription.formule]} ·{' '}
            {subscription.etat === 'expire'
              ? `terminée le ${formatLongDate(subscription.dateFin)}`
              : `jusqu'au ${formatLongDate(subscription.dateFin)} (${plural(subscription.joursRestants, 'jour restant', 'jours restants')})`}
          </p>
        )}
      </div>
      <div className="a-rise d3 mt-6">
        <AccountRows afterLogout="/" />
      </div>
    </ClientShell>
  );
}
