/**
 * Champs de formulaire « pilule » de la maquette (fond vert pâle, icône à gauche).
 */

import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  icon?: IconName;
  /** Libellé affiché au-dessus du champ (formulaires admin) ; sinon le placeholder sert de libellé */
  label?: string;
  hint?: ReactNode;
  invalid?: boolean;
  height?: 'lg' | 'md';
  trailing?: ReactNode;
}

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 ml-1.5 block text-[13px] font-semibold text-ink-soft">
      {children}
    </label>
  );
}

export function FieldHint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="ml-1.5 mt-1.5 text-[12px] leading-snug text-muted">{children}</p>;
}

export function Field({ icon, label, hint, invalid, height = 'lg', trailing, type, id, className, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className={className}>
      {label && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}
      <div
        className={`flex w-full items-center gap-3 rounded-full bg-field px-[22px] text-field-ink transition-colors focus-within:bg-field-focus ${
          height === 'lg' ? 'h-[52px]' : 'h-12'
        } ${invalid ? 'a-shake ring-1 ring-danger/60' : ''}`}
      >
        {icon && <Icon name={icon} />}
        <input
          id={inputId}
          type={isPassword && revealed ? 'text' : type}
          aria-label={label ? undefined : rest.placeholder}
          aria-invalid={invalid || undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none"
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="flex text-muted"
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} />
          </button>
        )}
        {trailing}
      </div>
      <FieldHint>{hint}</FieldHint>
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  icon?: IconName;
  label?: string;
  hint?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}

/** Liste déroulante native habillée comme les champs de la maquette */
export function SelectField({ icon, label, hint, badge, id, className, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className}>
      {label && <FieldLabel htmlFor={selectId}>{label}</FieldLabel>}
      <div className="relative flex h-[52px] w-full items-center gap-3 rounded-full bg-field px-[22px] text-field-ink focus-within:bg-field-focus">
        {icon && <Icon name={icon} />}
        <select
          id={selectId}
          className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-base font-medium text-ink outline-none"
          {...rest}
        >
          {children}
        </select>
        {badge}
        <Icon name="chevronDown" size={18} className="pointer-events-none text-ink-soft" />
      </div>
      <FieldHint>{hint}</FieldHint>
    </div>
  );
}

/** Valeur en lecture seule présentée comme un champ (fiche client, récapitulatifs) */
export function ReadonlyField({
  icon,
  label,
  children,
  badge,
  hint,
}: {
  icon?: IconName;
  label?: string;
  children: ReactNode;
  badge?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="flex min-h-[52px] w-full items-center gap-3 rounded-full bg-field px-[22px] text-field-ink">
        {icon && <Icon name={icon} />}
        <span className="min-w-0 flex-1 truncate text-base font-medium text-ink">{children}</span>
        {badge}
      </div>
      <FieldHint>{hint}</FieldHint>
    </div>
  );
}

/** Pastille de prix « 35 000 FC / sem. » */
export function PriceBadge({ children }: { children: ReactNode }) {
  return (
    <span className="flex-none rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-on-accent">
      {children}
    </span>
  );
}
