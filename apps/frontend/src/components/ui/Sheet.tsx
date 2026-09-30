/**
 * Fenêtre glissante du bas (maquette : « Nouveau client », « Heure limite »…).
 * Sur grand écran, elle s'affiche centrée. Échap et un clic sur le fond la ferment.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Icône ronde au-dessus du titre (ex. cadenas de « Suppression impossible ») */
  badge?: ReactNode;
}

export function Sheet({ open, onClose, title, subtitle, children, badge }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6">
      <button
        type="button"
        aria-label="Fermer"
        tabIndex={-1}
        onClick={onClose}
        className="a-fade absolute inset-0 bg-[rgb(var(--c-overlay)/0.40)] backdrop-blur-[3px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="a-sheet no-scrollbar relative flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-y-auto rounded-t-5xl bg-surface px-5 pb-[max(34px,env(safe-area-inset-bottom))] pt-2.5 shadow-sheet outline-none lg:rounded-5xl lg:pb-8"
      >
        <span aria-hidden="true" className="h-[5px] w-10 flex-none self-center rounded-full bg-ink/25 lg:hidden" />
        {badge && <div className="mt-6">{badge}</div>}
        <h2 className={`${badge ? 'mt-4' : 'mt-[22px]'} font-serif text-[36px] leading-[1.05] tracking-[-0.01em] text-ink`}>{title}</h2>
        {subtitle && <div className="mt-1.5 text-[15px] leading-[1.45] text-ink-soft">{subtitle}</div>}
        <div className="mt-[22px] flex flex-col">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/** Rangée de boutons en bas d'une fenêtre (action principale puis Annuler) */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col gap-2.5">{children}</div>;
}
