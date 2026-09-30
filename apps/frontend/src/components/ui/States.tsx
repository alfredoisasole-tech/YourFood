/**
 * États d'attente, d'erreur et de liste vide.
 */

import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Spinner({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className ?? ''}`}
      role="status"
      aria-label="Chargement"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page text-accent">
      <Spinner size={30} />
    </div>
  );
}

export function SectionLoader() {
  return (
    <div className="flex justify-center py-16 text-accent">
      <Spinner size={26} />
    </div>
  );
}

/** Message d'erreur en ligne, sous un formulaire */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="a-rise px-1 text-[13px] leading-snug text-danger">
      {children}
    </p>
  );
}

/** Encadré d'information (verrouillé, annulé, automatique…) */
export function Notice({
  icon,
  title,
  children,
  tone = 'neutral',
}: {
  icon: IconName;
  title?: string;
  children: ReactNode;
  tone?: 'neutral' | 'danger' | 'success' | 'warn';
}) {
  const tones = {
    neutral: 'bg-card border-line/10 text-ink-soft',
    success: 'bg-accent/10 border-accent/20 text-accent-strong',
    danger: 'bg-danger/10 border-danger/30 text-danger',
    warn: 'bg-warn/10 border-warn/30 text-ink',
  }[tone];
  return (
    <div role="status" className={`flex items-start gap-3 rounded-[22px] border px-4 py-3.5 ${tones}`}>
      <Icon name={icon} size={18} className="mt-0.5" />
      <div className="flex flex-col gap-0.5 text-[14px] leading-snug">
        {title && <span className="font-semibold">{title}</span>}
        <span className={title ? 'opacity-90' : ''}>{children}</span>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <Icon name="info" />
      </span>
      <p className="max-w-[300px] text-[15px] text-ink-soft">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="press text-[15px] font-semibold text-accent-strong">
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-field text-accent-strong">
        <Icon name={icon} />
      </span>
      <p className="font-serif text-[26px] leading-tight text-ink">{title}</p>
      {children && <div className="max-w-[320px] text-[14px] leading-relaxed text-ink-soft">{children}</div>}
    </div>
  );
}
