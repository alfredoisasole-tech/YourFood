/**
 * Changement de mot de passe (client et administratrice). Les autres sessions sont fermées ;
 * la session courante reçoit un nouveau jeton.
 */

import { useState, type FormEvent } from 'react';
import { passwordSchema } from '@meal-app/shared';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../features/auth/AuthContext';
import { Sheet, SheetActions } from '../ui/Sheet';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import { FormError } from '../ui/States';
import { useToast } from '../ui/Toast';

export function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setCurrent('');
    setNext('');
    setConfirmation('');
    setError(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const check = passwordSchema.safeParse(next);
    if (!check.success) {
      setError(check.error.errors[0]?.message ?? 'Mot de passe trop court.');
      return;
    }
    if (next !== confirmation) {
      setError('Les deux nouveaux mots de passe ne sont pas identiques.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await authApi.changePassword({ ancienMotDePasse: current, nouveauMotDePasse: next });
      signIn(response);
      toast.show('Mot de passe modifié');
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Modification impossible, réessaie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={close} title="Nouveau mot de passe" subtitle="Tes autres appareils seront déconnectés.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field icon="lock" type="password" placeholder="Mot de passe actuel" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field icon="lock" type="password" placeholder="Nouveau : au moins 8 caractères" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <Field icon="lock" type="password" placeholder="Répète le nouveau mot de passe" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        <FormError>{error}</FormError>
        <SheetActions>
          <Button type="submit" loading={saving} icon="check">
            Enregistrer
          </Button>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
        </SheetActions>
      </form>
    </Sheet>
  );
}
