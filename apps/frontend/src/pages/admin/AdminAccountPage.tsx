/**
 * Compte de l'administratrice (compte unique) : mode sombre, mot de passe, déconnexion.
 */

import { AdminPage } from './AdminArea';
import { AccountRows } from '../../components/account/AccountRows';
import { LinkButton } from '../../components/ui/Button';

export function AdminAccountPage() {
  return (
    <AdminPage back="/admin" title="Administratrice" subtitle="Compte unique · Your Food">
      <AccountRows afterLogout="/admin/connexion" />
      <LinkButton to="/admin/statistiques" variant="soft" icon="chart" className="mt-6 lg:hidden">
        Voir les statistiques
      </LinkButton>
    </AdminPage>
  );
}
