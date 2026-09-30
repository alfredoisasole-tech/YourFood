/**
 * Première connexion, en deux étapes (SPEC 5.3 & 7) :
 * 1. « Bienvenue à table. » : identifiant + code reçu (vérifié sans être consommé) ;
 * 2. « Crée ton mot de passe. » : le code est consommé et la session ouverte.
 * Sert aussi après une réinitialisation du mot de passe par l'administratrice.
 */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AccessCodeType, passwordSchema } from '@meal-app/shared';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../features/auth/AuthContext';
import { Field } from '../../components/ui/Field';
import { Button, LinkButton } from '../../components/ui/Button';
import { FormError } from '../../components/ui/States';
import { Icon } from '../../components/ui/Icon';
import { formatLongDate } from '../../lib/format';
import { AuthScreen } from './AuthScreen';
import { clearPendingAccess, readPendingAccess } from './accessLink';

type Step = 'code' | 'password' | 'not-started';

export function FirstLoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [pending] = useState(readPendingAccess);

  const [step, setStep] = useState<Step>('code');
  const [identifiant, setIdentifiant] = useState(pending?.nom ?? '');
  const [code, setCode] = useState(pending?.code ?? '');
  const [prenom, setPrenom] = useState('');
  const [isReset, setIsReset] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const fail = (message: string) => {
    setError(message);
    setAttempt((n) => n + 1);
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifiant.trim() || code.replace(/\s/g, '').length !== 8) {
      fail('Entre ton prénom, ton nom et le code à 8 caractères.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.verifyCode({ identifiant, code });
      setPrenom(result.prenom);
      setIsReset(result.type === AccessCodeType.REINITIALISATION);
      setStep('password');
    } catch (err) {
      fail(err instanceof ApiError ? err.message : 'Une erreur est survenue, réessaie.');
    } finally {
      setBusy(false);
    }
  };

  const createPassword = async (event: FormEvent) => {
    event.preventDefault();
    const check = passwordSchema.safeParse(password);
    if (!check.success) {
      fail(check.error.errors[0]?.message ?? 'Mot de passe trop court.');
      return;
    }
    if (password !== confirmation) {
      fail('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await authApi.firstLogin({ identifiant, code, nouveauMotDePasse: password });
      clearPendingAccess();
      if (response.subscription?.etat === 'non_commence') {
        setStartDate(response.subscription.dateDebut);
        setStep('not-started');
        return;
      }
      signIn(response);
      navigate('/menu', { replace: true });
    } catch (err) {
      fail(err instanceof ApiError ? err.message : 'Une erreur est survenue, réessaie.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'not-started') {
    return (
      <AuthScreen title="C'est prêt." subtitle={`Ton mot de passe est enregistré, ${prenom}.`}>
        <div className="flex flex-col gap-6">
          <p className="a-rise d3 rounded-[22px] bg-field px-5 py-4 text-center text-[15px] leading-relaxed text-ink">
            Ton abonnement commence le <strong>{formatLongDate(startDate)}</strong>. Reviens ce jour-là, on t'attend à table.
          </p>
          <LinkButton to="/connexion">Aller à la connexion</LinkButton>
        </div>
      </AuthScreen>
    );
  }

  if (step === 'password') {
    return (
      <AuthScreen
        title={isReset ? 'Nouveau mot de passe.' : 'Crée ton mot de passe.'}
        subtitle="Rien qu'à toi, pour revenir à table chaque jour."
      >
        <form onSubmit={createPassword} noValidate className="flex flex-col">
          <div key={attempt} className="flex flex-col gap-3">
            <Field
              icon="lock"
              type="password"
              placeholder="Au moins 8 caractères"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={Boolean(error)}
            />
            <Field
              icon="lock"
              type="password"
              placeholder="Répète le mot de passe"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              invalid={Boolean(error)}
            />
          </div>
          <p className="a-pop mt-3 flex items-center gap-1.5 px-1 text-[13px] font-medium text-accent-strong">
            <Icon name="check" size={16} strokeWidth={2.2} />
            Code accepté, bienvenue{prenom ? ` ${prenom}` : ''}.
          </p>
          <div className="mt-2">
            <FormError>{error}</FormError>
          </div>
          <Button type="submit" loading={busy} className="mt-5">
            Créer et entrer
          </Button>
        </form>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      backTo="/"
      title="Bienvenue à table."
      subtitle={pending ? 'Ton code est prêt : vérifie ton nom et continue.' : 'Entre le code reçu sur WhatsApp pour commencer.'}
    >
      <form onSubmit={verify} noValidate className="flex flex-col">
        <div key={attempt} className="flex flex-col gap-3">
          <Field
            icon="user"
            placeholder="Ton prénom et ton nom"
            autoComplete="username"
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            invalid={Boolean(error)}
          />
          <Field
            icon="key"
            placeholder="Code à 8 caractères"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={9}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            invalid={Boolean(error)}
          />
        </div>
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
        <Button type="submit" loading={busy} className="mt-6">
          Continuer
        </Button>
        <Link to="/connexion" className="mt-2 flex min-h-11 items-center justify-center text-[15px] font-semibold text-accent-strong">
          J'ai déjà un mot de passe
        </Link>
      </form>
    </AuthScreen>
  );
}
