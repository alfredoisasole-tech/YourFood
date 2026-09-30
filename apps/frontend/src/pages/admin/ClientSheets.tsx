/**
 * Fenêtres de la fiche client : renouvellement, modification, accès (bienvenue / réinitialisation).
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
  nextMonday,
  updateClientSchema,
  type AccessDelivery,
  type ClientDetailView,
  type SubscriptionView,
} from '@meal-app/shared';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { Sheet, SheetActions } from '../../components/ui/Sheet';
import { Field } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { FormError, Notice } from '../../components/ui/States';
import { AccessPanel } from '../../components/access/AccessPanel';
import { SubscriptionFields, type SubscriptionDraft } from '../../components/subscription/SubscriptionFields';
import { PhoneInput } from './NewClientSheet';
import { useToast } from '../../components/ui/Toast';
import { upcomingMondays } from '../../lib/calendar';
import { FORMULE_LABEL, formatLongDate, todayKinshasa } from '../../lib/format';

/** Premier lundi possible pour une nouvelle période : après la fin de la dernière période */
function firstRenewalMonday(detail: ClientDetailView, today: string): string {
  const lastEnd = detail.historiqueAbonnements.reduce((latest, sub) => (sub.dateFin > latest ? sub.dateFin : latest), '0000-00-00');
  return nextMonday(lastEnd > today ? lastEnd : today);
}

export function RenewSheet({
  open,
  onClose,
  detail,
  onRenewed,
}: {
  open: boolean;
  onClose: () => void;
  detail: ClientDetailView;
  onRenewed: (subscription: SubscriptionView) => void;
}) {
  const today = todayKinshasa();
  const current = detail.abonnementCourant;
  const first = firstRenewalMonday(detail, today);
  const mondays = upcomingMondays(first, 12);
  const [draft, setDraft] = useState<SubscriptionDraft>(() => ({
    formule: current?.formule ?? detail.historiqueAbonnements[0]?.formule ?? ('35000' as SubscriptionDraft['formule']),
    duree: { unite: 'semaines', valeur: 1 },
    dateDebut: first,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setDraft((d) => ({ ...d, dateDebut: first }));
  }, [open, first]);

  const submit = async () => {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      onRenewed(await adminApi.renew(current.id, draft));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Renouvellement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const name = `${detail.client.prenom} ${detail.client.nom}`;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Renouveler l'abonnement"
      subtitle={
        current
          ? `${name} · ${FORMULE_LABEL[current.formule]} jusqu'au ${formatLongDate(current.dateFin)}.`
          : name
      }
    >
      <SubscriptionFields
        draft={draft}
        onChange={setDraft}
        mondays={mondays}
        startHint="L'ancienne période reste valable jusqu'à sa fin et dans l'historique."
      />
      <div className="mt-4">
        <Notice icon="lock">Aucun nouveau code ni lien : {detail.client.prenom} garde son accès.</Notice>
      </div>
      <div className="mt-2">
        <FormError>{error}</FormError>
      </div>
      <SheetActions>
        <Button icon="check" onClick={submit} loading={saving}>
          Valider le renouvellement
        </Button>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
      </SheetActions>
    </Sheet>
  );
}

function splitPhone(phone: string | null): { country: string; number: string } {
  if (!phone) return { country: '+243', number: '' };
  const match = /^(\+\d{1,3}?)(\d{8,10})$/.exec(phone);
  if (phone.startsWith('+243')) return { country: '+243', number: phone.slice(4) };
  return match ? { country: match[1] as string, number: match[2] as string } : { country: '+243', number: phone };
}

export function EditClientSheet({
  open,
  onClose,
  detail,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  detail: ClientDetailView;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [nom, setNom] = useState(detail.client.nom);
  const [prenom, setPrenom] = useState(detail.client.prenom);
  const [phone, setPhone] = useState(splitPhone(detail.client.telephone));
  const [bonus, setBonus] = useState(detail.abonnementCourant?.bonus ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNom(detail.client.nom);
    setPrenom(detail.client.prenom);
    setPhone(splitPhone(detail.client.telephone));
    setBonus(detail.abonnementCourant?.bonus ?? '');
    setError(null);
  }, [open, detail]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const check = updateClientSchema.safeParse({
      nom,
      prenom,
      telephone: phone.number.trim() ? `${phone.country}${phone.number}` : null,
      bonus: bonus.trim() || null,
    });
    if (!check.success) {
      setError(check.error.errors[0]?.message ?? 'Formulaire invalide.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateClient(detail.client.id, check.data);
      toast.show('Fiche mise à jour');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const loginChanged = nom.trim() !== detail.client.nom || prenom.trim() !== detail.client.prenom;

  return (
    <Sheet open={open} onClose={onClose} title="Modifier la fiche" subtitle="Corrige ses informations.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nom" icon="user" value={nom} onChange={(e) => setNom(e.target.value)} />
        <Field label="Prénom" icon="user" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
        {loginChanged && (
          <Notice icon="info" tone="warn">
            Son identifiant de connexion devient « {prenom.trim()} {nom.trim()} ». Préviens-le.
          </Notice>
        )}
        <PhoneInput
          country={phone.country}
          number={phone.number}
          onCountry={(country) => setPhone((p) => ({ ...p, country }))}
          onNumber={(number) => setPhone((p) => ({ ...p, number }))}
        />
        <Field label="Bonus de la période en cours" icon="star" placeholder="Aucun" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        <FormError>{error}</FormError>
        <SheetActions>
          <Button type="submit" icon="check" loading={saving}>
            Enregistrer
          </Button>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </SheetActions>
      </form>
    </Sheet>
  );
}

export type AccessMode = 'bienvenue' | 'reinitialisation';

export function AccessSheet({
  mode,
  onClose,
  detail,
}: {
  mode: AccessMode | null;
  onClose: () => void;
  detail: ClientDetailView;
}) {
  const [access, setAccess] = useState<AccessDelivery | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAccess(null);
    setError(null);
    if (mode === 'bienvenue') {
      setLoading(true);
      adminApi
        .resendWelcome(detail.client.id)
        .then(setAccess)
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Action impossible.'))
        .finally(() => setLoading(false));
    }
  }, [mode, detail.client.id]);

  const reset = async () => {
    if (!detail.abonnementCourant) return;
    setLoading(true);
    setError(null);
    try {
      setAccess(await adminApi.resetPassword(detail.abonnementCourant.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réinitialisation impossible.');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'bienvenue' ? 'Message de bienvenue' : 'Réinitialiser le mot de passe';
  const subtitle =
    mode === 'bienvenue'
      ? `Le même code, tant que ${detail.client.prenom} ne s'est pas connecté.`
      : access
        ? `Un nouveau code à usage unique pour ${detail.client.prenom}.`
        : `${detail.client.prenom} recevra un nouveau code pour choisir un nouveau mot de passe. Ses sessions ouvertes seront fermées quand il l'utilisera.`;

  return (
    <Sheet open={mode !== null} onClose={onClose} title={title} subtitle={subtitle}>
      {access ? (
        <AccessPanel access={access} codeLabel={mode === 'bienvenue' ? "Code d'activation" : 'Nouveau code'} />
      ) : (
        <>
          <FormError>{error}</FormError>
          {mode === 'reinitialisation' && !error && (
            <Button icon="key" onClick={reset} loading={loading}>
              Générer un nouveau code
            </Button>
          )}
          {mode === 'bienvenue' && loading && <p className="text-[14px] text-muted">Préparation du message…</p>}
        </>
      )}
      <SheetActions>
        <Button variant="outline" onClick={onClose}>
          {access ? 'Terminer' : 'Fermer'}
        </Button>
      </SheetActions>
    </Sheet>
  );
}
