/**
 * « Nouveau client » (SPEC 5.1 & 5.2) : ses infos, puis son accès en un geste.
 * Le téléphone est facultatif ; l'abonnement commence un lundi et finit un vendredi.
 */

import { useState, type FormEvent } from 'react';
import { createClientSchema, SubscriptionPlan, type CreateClientResponse } from '@meal-app/shared';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { Sheet, SheetActions } from '../../components/ui/Sheet';
import { Field, FieldLabel, ReadonlyField, PriceBadge } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { FormError } from '../../components/ui/States';
import { AccessPanel } from '../../components/access/AccessPanel';
import { SubscriptionFields, type SubscriptionDraft } from '../../components/subscription/SubscriptionFields';
import { upcomingMondays } from '../../lib/calendar';
import { FORMULE_LABEL, formatFc, formatPeriod, plural, todayKinshasa } from '../../lib/format';

const COUNTRY_CODES = ['+243', '+242', '+244', '+250', '+257', '+33', '+32', '+1'];

export function PhoneInput({
  country,
  number,
  onCountry,
  onNumber,
  invalid,
}: {
  country: string;
  number: string;
  onCountry: (value: string) => void;
  onNumber: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <div>
      <FieldLabel htmlFor="telephone">Téléphone (facultatif)</FieldLabel>
      <div className="flex gap-2">
        <label className="relative flex h-[52px] flex-none items-center rounded-full bg-accent px-4 text-on-accent">
          <span className="sr-only">Indicatif</span>
          <select value={country} onChange={(e) => onCountry(e.target.value)} className="cursor-pointer appearance-none bg-transparent pr-4 text-base font-semibold outline-none">
            {COUNTRY_CODES.map((code) => (
              <option key={code} value={code} className="text-ink">
                {code}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 text-xs">▾</span>
        </label>
        <Field
          id="telephone"
          icon="phone"
          className="flex-1"
          type="tel"
          inputMode="tel"
          placeholder="81 234 5678"
          value={number}
          onChange={(e) => onNumber(e.target.value)}
          invalid={invalid}
        />
      </div>
    </div>
  );
}

export function NewClientSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const today = todayKinshasa();
  const mondays = upcomingMondays(today, 12);

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [country, setCountry] = useState('+243');
  const [number, setNumber] = useState('');
  const [bonus, setBonus] = useState('');
  const [draft, setDraft] = useState<SubscriptionDraft>({
    formule: SubscriptionPlan.PLAN_35000,
    duree: { unite: 'semaines', valeur: 1 },
    dateDebut: mondays.find((m) => m > today) ?? (mondays[0] as string),
  });
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreateClientResponse | null>(null);

  const reset = () => {
    setNom('');
    setPrenom('');
    setNumber('');
    setBonus('');
    setError(null);
    setInvalidField(null);
    setCreated(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      nom,
      prenom,
      telephone: number.trim() ? `${country}${number}` : undefined,
      formule: draft.formule,
      duree: draft.duree,
      dateDebut: draft.dateDebut,
      bonus: bonus.trim() || undefined,
    };
    const check = createClientSchema.safeParse(payload);
    if (!check.success) {
      const issue = check.error.errors[0];
      setInvalidField(String(issue?.path[0] ?? ''));
      setError(issue?.message ?? 'Formulaire incomplet.');
      return;
    }
    setSaving(true);
    setError(null);
    setInvalidField(null);
    try {
      setCreated(await adminApi.createClient(check.data));
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inscription impossible, réessaie.');
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    const sub = created.subscription;
    return (
      <Sheet open={open} onClose={close} title={`${created.client.prenom}, c'est fait.`} subtitle="Envoie-lui son accès pour passer à table.">
        <div className="flex flex-col gap-4">
          <ReadonlyField label="Formule" icon="dish" badge={<PriceBadge>{formatFc(sub.totalFc / sub.dureeSemaines)} / sem.</PriceBadge>}>
            {FORMULE_LABEL[sub.formule]}
          </ReadonlyField>
          <ReadonlyField label="Durée" icon="calendar">
            {plural(sub.dureeSemaines, 'semaine')} · {formatFc(sub.totalFc)}
          </ReadonlyField>
          <ReadonlyField label="Période" icon="flag">
            {formatPeriod(sub.dateDebut, sub.dateFin)}
          </ReadonlyField>
          <AccessPanel access={created.acces} />
        </div>
        <SheetActions>
          <Button variant="outline" onClick={close}>
            Terminer
          </Button>
        </SheetActions>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title="Nouveau client" subtitle="Ses infos d'abord, puis son accès en un geste.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Nom" icon="user" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" invalid={invalidField === 'nom'} />
        <Field label="Prénom" icon="user" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="off" invalid={invalidField === 'prenom'} />
        <PhoneInput country={country} number={number} onCountry={setCountry} onNumber={setNumber} invalid={invalidField === 'telephone'} />
        <SubscriptionFields draft={draft} onChange={setDraft} mondays={mondays} />
        <Field label="Bonus" icon="star" placeholder="À définir" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        <FormError>{error}</FormError>
        <SheetActions>
          <Button type="submit" loading={saving} icon="key">
            Créer le code et le lien
          </Button>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
        </SheetActions>
        <p className="-mt-2 text-center text-[12px] text-muted">
          Un code à 8 caractères et un lien unique, valables jusqu'à la première connexion.
        </p>
      </form>
    </Sheet>
  );
}
