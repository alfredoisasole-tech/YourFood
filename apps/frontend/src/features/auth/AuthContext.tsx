/**
 * Session de l'utilisateur connecté (client ou administratrice).
 * Le jeton est gardé dans le navigateur ; la session est relue auprès de l'API au démarrage
 * (GET /auth/me), ce qui recalcule l'état de l'abonnement.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, SubscriptionView, User } from '@meal-app/shared';
import { authApi } from '../../api/endpoints';
import { getToken, setToken, setUnauthorizedListener } from '../../api/client';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: User | null;
  subscription: SubscriptionView | null;
  /** Enregistre une session ouverte (connexion, première connexion, changement de mot de passe) */
  signIn: (response: AuthResponse) => void;
  signOut: () => void;
  /** Relit la session (ex. après un renouvellement) */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() => (getToken() ? 'loading' : 'anonymous'));
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setSubscription(null);
    setStatus('anonymous');
  }, []);

  const signIn = useCallback((response: AuthResponse) => {
    setToken(response.token);
    setUser(response.user);
    setSubscription(response.subscription);
    setStatus('authenticated');
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setStatus('anonymous');
      return;
    }
    try {
      const session = await authApi.me();
      setUser(session.user);
      setSubscription(session.subscription);
      setStatus('authenticated');
    } catch {
      signOut();
    }
  }, [signOut]);

  useEffect(() => {
    setUnauthorizedListener(signOut);
    void refresh();
    return () => setUnauthorizedListener(null);
  }, [refresh, signOut]);

  const value = useMemo(
    () => ({ status, user, subscription, signIn, signOut, refresh }),
    [status, user, subscription, signIn, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return context;
}
