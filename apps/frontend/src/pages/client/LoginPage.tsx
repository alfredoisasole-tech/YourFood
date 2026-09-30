/**
 * Connexion client : identifiant (« Prénom Nom ») + mot de passe (SPEC 5.3 & 7).
 * Erreurs : identifiants invalides, abonnement pas encore commencé.
 */

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Role } from '@meal-app/shared';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../features/auth/AuthContext';
import { Field } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { FormError } from '../../components/ui/States';
import { AuthScreen } from './AuthScreen';

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Ce nom ou ce mot de passe ne correspond pas.';
    return err.message;
  }
  return 'Une erreur est survenue, réessaie.';
}

export function LoginPage() {
  const { status, user, signIn } = useAuth();
  const navigate = useNavigate();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (status === 'authenticated' && user) {
    return <Navigate to={user.role === Role.ADMIN ? '/admin' : '/menu'} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifiant.trim() || !motDePasse) {
      setError('Entre ton nom et ton mot de passe.');
      setAttempt((n) => n + 1);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await authApi.login({ identifiant, motDePasse });
      signIn(response);
      navigate(response.user.role === Role.ADMIN ? '/admin' : '/menu', { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
      setAttempt((n) => n + 1);
    } finally {
      setPending(false);
    }
  };

  const invalid = Boolean(error) && attempt > 0;

  return (
    <AuthScreen backTo="/" title="Bon retour." subtitle="Ton repas du jour t'attend.">
      <form onSubmit={submit} noValidate className="flex flex-col">
        <div key={attempt} className="flex flex-col gap-3">
          <Field
            icon="user"
            placeholder="Ton prénom et ton nom"
            autoComplete="username"
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            invalid={invalid}
          />
          <Field
            icon="lock"
            type="password"
            placeholder="Ton mot de passe"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            invalid={invalid}
          />
        </div>
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
        <Button type="submit" loading={pending} className="a-rise d5 mt-6">
          Se connecter
        </Button>
        <div className="mt-2 flex flex-col items-center text-center">
          <Link to="/premiere-connexion" className="flex min-h-11 items-center text-[15px] font-semibold text-accent-strong">
            Première fois ? Entre avec ton code
          </Link>
          <p className="max-w-[300px] text-[13px] leading-[1.45] text-muted">
            Un trou de mémoire ? L'administratrice te dépannera.
          </p>
        </div>
      </form>
    </AuthScreen>
  );
}
