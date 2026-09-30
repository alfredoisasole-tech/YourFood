/**
 * Connexion de l'administratrice (maquette : motif à pois vert et orange, « Espace admin »).
 */

import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Role } from '@meal-app/shared';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../features/auth/AuthContext';
import { Field } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { FormError } from '../../components/ui/States';
import { Logo } from '../../components/ui/Controls';

/** Motif à pois dégradé du vert à l'orange, qui s'efface vers le bas */
export function DotPattern({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 ${className ?? ''}`}
      style={{ maskImage: 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,.5) 45%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,.5) 45%, transparent 100%)' }}
    >
      <div
        className="h-full w-full opacity-40"
        style={{
          background: 'linear-gradient(115deg, #1F7A4D 0%, #6FB488 45%, #F59A45 100%)',
          maskImage: 'radial-gradient(circle, #000 4px, transparent 4.5px)',
          WebkitMaskImage: 'radial-gradient(circle, #000 4px, transparent 4.5px)',
          maskSize: '24px 24px',
          WebkitMaskSize: '24px 24px',
        }}
      />
    </div>
  );
}

export function AdminLoginPage() {
  const { status, user, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (status === 'authenticated' && user?.role === Role.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await authApi.login({ identifiant, motDePasse });
      if (response.user.role !== Role.ADMIN) {
        signOut();
        setError("Cet espace est réservé à l'administratrice.");
        setAttempt((n) => n + 1);
        return;
      }
      signIn(response);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Cet identifiant ou ce mot de passe ne correspond pas.'
          : err instanceof ApiError
            ? err.message
            : 'Une erreur est survenue, réessaie.'
      );
      setAttempt((n) => n + 1);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      <DotPattern className="h-[360px]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-6 pb-10">
        <div className="flex items-start justify-between pt-8">
          <span className="a-fade mt-2 rounded-full bg-surface/80 px-3 pb-1.5 pt-[5px] font-serif text-[17px] italic leading-none text-accent backdrop-blur-md">
            Espace admin
          </span>
          <Logo height={64} />
        </div>
        <div className="mt-[120px] flex flex-col">
          <h1 className="a-rise d1 text-center font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-accent-strong">Bon retour.</h1>
          <p className="a-rise d2 mt-1.5 text-center text-[15px] text-ink-soft">Les repas du jour t'attendent.</p>
          <form onSubmit={submit} noValidate className="mt-8 flex flex-col">
            <div key={attempt} className="flex flex-col gap-3">
              <Field icon="user" placeholder="Ton identifiant" autoComplete="username" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} invalid={Boolean(error)} />
              <Field icon="lock" type="password" placeholder="Ton mot de passe" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} invalid={Boolean(error)} />
            </div>
            <div className="mt-3">
              <FormError>{error}</FormError>
            </div>
            <Button type="submit" loading={pending} className="mt-5">
              Se connecter
            </Button>
            <p className="mt-4 text-center text-[13px] text-muted">Accès réservé à l'administratrice.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
