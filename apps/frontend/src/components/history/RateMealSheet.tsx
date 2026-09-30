/**
 * Noter un repas passé depuis l'historique (avis facultatif, SPEC 5.9).
 */

import { useEffect, useState } from 'react';
import { clientApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { Sheet, SheetActions } from '../ui/Sheet';
import { Stars } from '../ui/Controls';
import { Button } from '../ui/Button';
import { FormError } from '../ui/States';
import { formatLongDate } from '../../lib/format';
import type { HistoryRow } from './HistoryList';

export function RateMealSheet({ row, onClose, onSaved }: { row: HistoryRow | null; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote(0);
    setComment('');
    setError(null);
  }, [row?.orderId]);

  const save = async () => {
    if (!row) return;
    if (!note && !comment.trim()) {
      setError('Ajoute une note ou un commentaire.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await clientApi.submitReview({
        orderId: row.orderId,
        ...(note ? { noteEtoile: note } : {}),
        ...(comment.trim() ? { commentaire: comment.trim() } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible, réessaie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={row !== null}
      onClose={onClose}
      title="Noter ce repas"
      subtitle={row ? `${row.platNom ?? 'Ton repas'} · ${formatLongDate(row.date)}` : undefined}
    >
      <Stars value={note} onChange={setNote} size={30} label="Ta note" />
      <textarea
        aria-label="Commentaire"
        placeholder="Dis-nous ce que tu as aimé…"
        rows={3}
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="mt-3 w-full resize-none rounded-[22px] bg-field px-5 py-4 text-[15px] text-ink outline-none focus:bg-field-focus"
      />
      <div className="mt-2">
        <FormError>{error}</FormError>
      </div>
      <SheetActions>
        <Button onClick={save} loading={saving} icon="check">
          Envoyer mon avis
        </Button>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
      </SheetActions>
    </Sheet>
  );
}
