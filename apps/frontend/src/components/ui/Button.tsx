/**
 * Boutons « pilule » de la maquette.
 * - primary : plein, couleur d'accent (Se connecter, Confirmer mon repas)
 * - soft : fond vert pâle (Annuler mon repas, Renvoyer le message…)
 * - outline : contour fin (Annuler dans les fenêtres)
 * - quiet : désactivé visuellement mais lisible (Bon appétit, Repas annulé)
 * - danger : texte rouge (Se déconnecter, Supprimer)
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { Spinner } from './States';

type Variant = 'primary' | 'soft' | 'outline' | 'quiet' | 'danger' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent',
  soft: 'bg-field text-accent-strong',
  outline: 'bg-surface text-ink border border-line/15',
  quiet: 'bg-ink/[0.07] text-muted',
  danger: 'bg-surface text-danger border border-line/15',
  ghost: 'bg-transparent text-accent-strong',
};

const SIZES: Record<Size, string> = {
  lg: 'h-14 px-6 text-base gap-2',
  md: 'h-12 px-5 text-[15px] gap-2',
  sm: 'h-10 px-4 text-sm gap-1.5',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  block?: boolean;
  children: ReactNode;
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'lg', block = true): string {
  return [
    'press inline-flex items-center justify-center rounded-full font-semibold tracking-[0.01em]',
    'disabled:cursor-default',
    VARIANTS[variant],
    SIZES[size],
    block ? 'w-full' : '',
  ].join(' ');
}

export function Button({
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  block = true,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${buttonClass(variant, size, block)} ${disabled && variant === 'primary' ? 'opacity-50' : ''} ${className ?? ''}`}
      {...rest}
    >
      {loading ? <Spinner size={18} /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}

interface LinkButtonProps {
  to: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  block?: boolean;
  className?: string;
  children: ReactNode;
}

export function LinkButton({ to, variant = 'primary', size = 'lg', icon, block = true, className, children }: LinkButtonProps) {
  return (
    <Link to={to} className={`${buttonClass(variant, size, block)} ${className ?? ''}`}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </Link>
  );
}

/** Bouton rond (retour, statistiques, actions de ligne) */
export function IconButton({
  icon,
  label,
  onClick,
  variant = 'field',
  size = 44,
  className,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  variant?: 'field' | 'surface' | 'plain' | 'accent';
  size?: number;
  className?: string;
  disabled?: boolean;
}) {
  const styles = {
    field: 'bg-field text-accent-strong',
    surface: 'bg-surface text-ink shadow-soft',
    plain: 'bg-transparent text-ink-soft',
    accent: 'bg-accent text-on-accent',
  }[variant];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{ width: size, height: size }}
      className={`press flex flex-none items-center justify-center rounded-full disabled:opacity-40 ${styles} ${className ?? ''}`}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </button>
  );
}
