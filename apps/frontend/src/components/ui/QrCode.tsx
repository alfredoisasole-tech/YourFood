/**
 * QR code du lien d'accès : l'administratrice l'affiche, le client le scanne (SPEC 5.2).
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Spinner } from './States';

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1E1C1A', light: '#FFFFFF' } })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => setSvg(null));
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center overflow-hidden rounded-3xl bg-white p-3"
      role="img"
      aria-label="QR code du lien d'accès"
    >
      {svg ? (
        // Le SVG est produit localement par la bibliothèque qrcode à partir du lien : aucun contenu externe
        <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <Spinner />
      )}
    </div>
  );
}
