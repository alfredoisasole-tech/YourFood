/**
 * Mise en page des écrans de connexion (maquette : retour à gauche, logo à droite, titre centré).
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { Logo } from '../../components/ui/Controls';

export function AuthScreen({
  backTo,
  title,
  subtitle,
  children,
  header,
}: {
  backTo?: string;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  /** Remplace la barre du haut (espace admin) */
  header?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-6 pb-10">
        {header ?? (
          <div className="flex items-start justify-between pt-6">
            {backTo ? (
              <Link
                to={backTo}
                aria-label="Retour"
                className="a-fade press mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-field text-accent-strong"
              >
                <Icon name="chevronLeft" />
              </Link>
            ) : (
              <span />
            )}
            <Logo height={64} />
          </div>
        )}
        <div className="mt-11 flex flex-col">
          <h1 className="a-rise d1 text-center font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-accent-strong">
            {title}
          </h1>
          <p className="a-rise d2 mx-auto mt-1.5 max-w-[320px] text-center text-[15px] leading-[1.45] text-ink-soft">
            {subtitle}
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
