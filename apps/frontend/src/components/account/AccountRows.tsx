/**
 * Lignes de la page Compte (maquette) : mode sombre, mot de passe, déconnexion.
 */

import { useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../ui/Icon';
import { Toggle } from '../ui/Controls';
import { useTheme } from '../../lib/theme';
import { useAuth } from '../../features/auth/AuthContext';
import { ChangePasswordSheet } from './ChangePasswordSheet';

function Row({ icon, label, children, onClick, tone = 'ink' }: { icon: IconName; label: string; children?: ReactNode; onClick?: () => void; tone?: 'ink' | 'danger' }) {
  const content = (
    <>
      <Icon name={icon} size={18} />
      <span className="flex-1 text-left text-[14px] font-medium">{label}</span>
      {children}
    </>
  );
  const className = `flex min-h-[52px] w-full items-center gap-3 rounded-full border border-line/[0.1] bg-surface px-5 ${
    tone === 'danger' ? 'text-danger' : 'text-ink'
  }`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`press ${className}`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function AccountRows({ afterLogout }: { afterLogout: string }) {
  const { isDark, toggle } = useTheme();
  const { signOut } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      <Row icon="moon" label="Mode sombre">
        <Toggle checked={isDark} onChange={toggle} label="Mode sombre" />
      </Row>
      <Row icon="key" label="Renouveler mon mot de passe" onClick={() => setPasswordOpen(true)}>
        <Icon name="chevronRight" size={18} className="text-muted" />
      </Row>
      <Row
        icon="logout"
        label="Se déconnecter"
        tone="danger"
        onClick={() => {
          signOut();
          // Rechargement complet : aucune donnée de la session ne reste en mémoire
          window.location.replace(afterLogout);
        }}
      />
      <ChangePasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
