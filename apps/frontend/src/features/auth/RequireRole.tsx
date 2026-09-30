/**
 * Garde de route : réserve un espace à un rôle et renvoie vers la bonne page de connexion.
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Role } from '@meal-app/shared';
import { useAuth } from './AuthContext';
import { FullPageLoader } from '../../components/ui/States';

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageLoader />;
  }

  const loginPath = role === Role.ADMIN ? '/admin/connexion' : '/connexion';
  if (status === 'anonymous' || !user) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === Role.ADMIN ? '/admin' : '/menu'} replace />;
  }

  return <>{children}</>;
}
