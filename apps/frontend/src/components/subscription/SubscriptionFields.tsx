/**
 * Champs communs à l'inscription et au renouvellement : formule, durée, lundi de début,
 * vendredi de fin et total (prix hebdomadaire × semaines).
 */

import {
  MAX_DURATION_VALUE,
  SubscriptionPlan,
  computeSubscriptionEnd,
  durationToWeeks,
  subscriptionTotalFc,
  WEEKLY_PRICE_FC,
  type SubscriptionDuration,
} from '@meal-app/shared';
import { PriceBadge, ReadonlyField, SelectField } from '../ui/Field';
import { FORMULE_DESCRIPTION, FORMULE_LABEL, capitalize, formatFc, formatFullDate } from '../../lib/format';

export interface SubscriptionDraft {
  formule: SubscriptionPlan;
  duree: SubscriptionDuration;
  dateDebut: string;
}

export const DURATION_OPTIONS: { key: string; label: string; value: SubscriptionDuration }[] = [
  ...Array.from({ length: MAX_DURATION_VALUE.semaines }, (_, i) => ({
    key: `s${i + 1}`,
    label: i === 0 ? '1 semaine' : `${i + 1} semaines`,
    value: { unite: 'semaines' as const, valeur: i + 1 },
  })),
  ...Array.from({ length: MAX_DURATION_VALUE.mois }, (_, i) => ({
    key: `m${i + 1}`,
    label: `${i + 1} mois (${(i + 1) * 4} semaines)`,
    value: { unite: 'mois' as const, valeur: i + 1 },
  })),
];

export function durationKey(duree: SubscriptionDuration): string {
  return `${duree.unite === 'mois' ? 'm' : 's'}${duree.valeur}`;
}

export function SubscriptionFields({
  draft,
  onChange,
  mondays,
  startHint,
}: {
  draft: SubscriptionDraft;
  onChange: (draft: SubscriptionDraft) => void;
  mondays: string[];
  startHint?: string;
}) {
  const weeks = durationToWeeks(draft.duree);
  const dateFin = computeSubscriptionEnd(draft.dateDebut, weeks);
  const total = subscriptionTotalFc(draft.formule, weeks);

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label="Formule"
        icon="dish"
        value={draft.formule}
        onChange={(e) => onChange({ ...draft, formule: e.target.value as SubscriptionPlan })}
        badge={<PriceBadge>{formatFc(WEEKLY_PRICE_FC[draft.formule])} / sem.</PriceBadge>}
        hint={FORMULE_DESCRIPTION[draft.formule]}
      >
        {Object.values(SubscriptionPlan).map((plan) => (
          <option key={plan} value={plan}>
            {FORMULE_LABEL[plan]}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Durée"
        icon="calendar"
        value={durationKey(draft.duree)}
        onChange={(e) => {
          const option = DURATION_OPTIONS.find((o) => o.key === e.target.value);
          if (option) onChange({ ...draft, duree: option.value });
        }}
      >
        {DURATION_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Date de début"
        icon="flag"
        value={draft.dateDebut}
        onChange={(e) => onChange({ ...draft, dateDebut: e.target.value })}
        hint={startHint ?? 'Un abonnement commence toujours un lundi.'}
      >
        {mondays.map((monday) => (
          <option key={monday} value={monday}>
            {capitalize(formatFullDate(monday))}
          </option>
        ))}
      </SelectField>

      <ReadonlyField label="Date de fin" icon="calendar">
        {formatFullDate(dateFin)}
      </ReadonlyField>

      <div className="flex h-14 items-center justify-between rounded-full bg-field pl-[22px] pr-2">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold text-ink">Total</span>
          <span className="text-[12px] text-muted">
            {FORMULE_LABEL[draft.formule]} · {weeks} semaine{weeks > 1 ? 's' : ''} × {formatFc(WEEKLY_PRICE_FC[draft.formule])}
          </span>
        </span>
        <span className="rounded-full bg-accent px-4 py-2 text-[16px] font-bold text-on-accent">{formatFc(total)}</span>
      </div>
    </div>
  );
}
