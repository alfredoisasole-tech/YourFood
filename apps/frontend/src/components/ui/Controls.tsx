/**
 * Petits contrôles de la maquette : puces de filtre, interrupteur, avatar, étoiles, anneau, logo.
 */

import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useTheme } from '../../lib/theme';

/** Puces de filtre / onglets (fond noir pour l'élément actif, gris sinon) */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={`no-scrollbar flex gap-2 overflow-x-auto ${className ?? ''}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`press flex h-[34px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ${
              active ? 'bg-ink text-page' : 'border border-line/10 bg-ink/[0.05] text-ink-soft'
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={`text-[12px] font-medium ${active ? 'opacity-70' : 'text-muted'}`}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Puce à cocher (composition des menus) */
export function PickChip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`press inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold disabled:opacity-50 ${
        selected ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink-soft'
      }`}
    >
      {selected && <Icon name="check" size={14} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

/** Interrupteur (Mode sombre, Proposé sur la carte) */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 flex-none rounded-full transition-colors duration-300 disabled:opacity-50 ${
        checked ? 'bg-accent' : 'bg-ink/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] duration-300 ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  );
}

/** Avatar à initiales */
export function Avatar({ text, size = 44, className }: { text: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      className={`flex flex-none items-center justify-center rounded-full bg-field font-bold text-accent-strong ${className ?? ''}`}
    >
      {text}
    </span>
  );
}

/** Étoiles de notation, en lecture seule ou cliquables */
export function Stars({
  value,
  onChange,
  size = 14,
  label = 'Note',
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  label?: string;
}) {
  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`${label} : ${value} sur 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= value ? 'text-star' : 'text-ink/20'}>
            <Icon name="star" size={size} filled={n <= value} strokeWidth={1.5} />
          </span>
        ))}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`Note ${n} sur 5`}
          onClick={() => onChange(value === n ? 0 : n)}
          className={`flex h-11 w-11 items-center justify-center transition-transform hover:-rotate-6 hover:scale-110 ${
            n <= value ? 'text-star' : 'text-ink/25'
          }`}
        >
          <Icon name="star" size={size} filled={n <= value} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

/** Anneau de progression (Livraisons, Clients, Avis) */
export function Ring({
  percent,
  size = 44,
  stroke = 6,
  className,
  trackClassName = 'text-current opacity-25',
}: {
  percent: number;
  size?: number;
  stroke?: number;
  className?: string;
  trackClassName?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`-rotate-90 ${className ?? ''}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className={trackClassName} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }}
      />
    </svg>
  );
}

/** Logo « Your Food » : version couleur, blanche (sur photo) ou sombre */
export function Logo({ variant = 'auto', height = 64, className }: { variant?: 'auto' | 'white'; height?: number; className?: string }) {
  const { isDark } = useTheme();
  const src = variant === 'white' ? '/images/logo-blanc.png' : isDark ? '/images/logo-sombre.png' : '/images/logo.png';
  return <img src={src} alt="Your Food" style={{ height }} className={`block w-auto ${className ?? ''}`} />;
}

/** Libellé en italique serif (« choisi », « Formule 2 ») */
export function SerifTag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`font-serif text-[14px] italic lowercase tracking-[0.02em] ${className ?? ''}`}>{children}</span>;
}

/** Titre de section en petites capitales (« AUJOURD'HUI », « CETTE SEMAINE ») */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`text-[12px] font-semibold uppercase tracking-[0.14em] text-muted ${className ?? ''}`}>{children}</h2>
  );
}
