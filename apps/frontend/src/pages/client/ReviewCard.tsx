/**
 * « Un mot sur ton repas ? » : avis facultatif sur le repas du dernier jour ouvré (SPEC 5.9),
 * avec la barre de progression Menu → Avis → Note de la maquette.
 */

import { useState } from 'react';
import { clientApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { Stars } from '../../components/ui/Controls';
import { Button } from '../../components/ui/Button';
import { FormError } from '../../components/ui/States';
import { Icon } from '../../components/ui/Icon';
import { formatWeekday } from '../../lib/format';

export function ReviewCard({
  orderId,
  date,
  dimmed,
  onSent,
}: {
  orderId: number;
  date: string;
  dimmed?: boolean;
  onSent: () => void;
}) {
  const [note, setNote] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    { label: 'Menu', done: true },
    { label: 'Avis', done: comment.trim().length > 0 || note > 0 },
    { label: 'Note', done: note > 0 },
  ];

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await clientApi.submitReview({
        orderId,
        ...(note > 0 ? { noteEtoile: note } : {}),
        ...(comment.trim() ? { commentaire: comment.trim() } : {}),
      });
      setSent(true);
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible, réessaie.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <section className="a-pop mt-8 flex items-center gap-3 rounded-4xl border border-line/[0.08] bg-page p-[22px]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent">
          <Icon name="check" strokeWidth={2.4} />
        </span>
        <p className="text-[15px] leading-snug text-ink">
          Merci pour ton avis ! <span className="text-ink-soft">Il aide la cuisine à faire encore mieux.</span>
        </p>
      </section>
    );
  }

  return (
    <section className={`a-rise d6 mt-8 flex flex-col gap-3 rounded-4xl border border-line/[0.08] bg-page p-[22px] ${dimmed ? 'opacity-50' : ''}`}>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step) => (
          <div key={step.label} className="flex flex-col gap-1.5">
            <span className={`h-1 rounded-sm transition-colors ${step.done ? 'bg-accent' : 'bg-ink/15'}`} />
            <span className={`text-[12px] ${step.done ? 'font-semibold text-accent-strong' : 'font-medium text-muted'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-ink">Un mot sur ton repas ?</h2>
        <p className="text-[14px] leading-[1.45] text-ink-soft">
          Comment était celui de {formatWeekday(date)} ? Ton avis nous aide à faire encore mieux, mais rien ne
          t'oblige : c'est quand tu veux.
        </p>
      </div>
      <Stars value={note} onChange={setNote} size={26} label="Ta note" />
      <input
        type="text"
        aria-label="Commentaire"
        placeholder="Dis-nous ce que tu as aimé…"
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="h-12 w-full rounded-full border border-line/[0.12] bg-surface px-[18px] text-[15px] text-ink outline-none focus:border-accent/50"
      />
      <FormError>{error}</FormError>
      {(note > 0 || comment.trim()) && (
        <Button size="md" onClick={send} loading={sending} icon="send" className="a-rise">
          Envoyer mon avis
        </Button>
      )}
    </section>
  );
}
