/**
 * Transmission de l'accès au client (SPEC 5.2) : code, lien, QR code à scanner et message
 * WhatsApp pré-rempli (indisponible sans numéro de téléphone).
 */

import { useState } from 'react';
import type { AccessDelivery } from '@meal-app/shared';
import { Icon } from '../ui/Icon';
import { Button, buttonClass } from '../ui/Button';
import { QrCode } from '../ui/QrCode';
import { SectionTitle } from '../ui/Controls';
import { useToast } from '../ui/Toast';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AccessPanel({ access, codeLabel = "Code d'activation" }: { access: AccessDelivery; codeLabel?: string }) {
  const toast = useToast();
  const [showQr, setShowQr] = useState(false);

  const copy = async (text: string, message: string) => {
    const copied = await copyText(text);
    toast.show(copied ? message : 'Copie impossible : sélectionne le texte', copied ? 'success' : 'error');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-3 rounded-4xl bg-field px-5 py-5">
        <span className="text-[13px] font-medium text-ink-soft">{codeLabel}</span>
        <span className="select-all font-mono text-[30px] font-bold tracking-[0.12em] text-accent-strong">{access.codeAffichage}</span>
        <button
          type="button"
          onClick={() => void copy(access.code, 'Code copié')}
          className="press flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-[14px] font-semibold text-accent-strong"
        >
          <Icon name="copy" size={16} />
          Copier le code
        </button>
      </div>

      <div className="flex h-12 items-center gap-3 rounded-full bg-field pl-5 pr-2">
        <span className="min-w-0 flex-1 truncate text-[14px] text-ink" title={access.lien}>
          {access.lien.replace(/^https?:\/\//, '').replace(/#.*$/, '')}
        </span>
        <button type="button" aria-label="Copier le lien" onClick={() => void copy(access.lien, 'Lien copié')} className="press flex h-9 w-9 items-center justify-center rounded-full text-accent-strong hover:bg-surface">
          <Icon name="copy" size={17} />
        </button>
        <button
          type="button"
          aria-label={showQr ? 'Masquer le QR code' : 'Afficher le QR code'}
          aria-pressed={showQr}
          onClick={() => setShowQr((v) => !v)}
          className={`press flex h-9 w-9 items-center justify-center rounded-full ${showQr ? 'bg-accent text-on-accent' : 'text-accent-strong hover:bg-surface'}`}
        >
          <Icon name="qr" size={17} />
        </button>
      </div>

      {showQr && (
        <div className="a-drop flex flex-col items-center gap-2 py-2">
          <QrCode value={access.lien} />
          <p className="max-w-[280px] text-center text-[13px] text-ink-soft">
            Le client scanne ce code avec l'appareil photo de son téléphone : il arrive directement sur son accès.
          </p>
        </div>
      )}

      <SectionTitle className="mt-2">Message de bienvenue</SectionTitle>
      <div className="whitespace-pre-line rounded-[22px] border border-line/10 bg-surface px-4 py-3.5 text-[14px] leading-relaxed text-ink">
        {access.message}
      </div>

      {access.whatsappUrl ? (
        <a href={access.whatsappUrl} target="_blank" rel="noreferrer" className={`${buttonClass('primary', 'lg')} mt-1`}>
          <Icon name="whatsapp" size={18} />
          Envoyer sur WhatsApp
        </a>
      ) : (
        <>
          <Button variant="quiet" icon="whatsapp" disabled className="mt-1">
            Envoyer sur WhatsApp
          </Button>
          <p className="-mt-1 text-center text-[12px] text-muted">
            Pas de numéro enregistré : montre le QR code ou copie le lien.
          </p>
        </>
      )}
      <Button variant="soft" icon="copy" onClick={() => void copy(access.message, 'Message copié')}>
        Copier le message
      </Button>
    </div>
  );
}
