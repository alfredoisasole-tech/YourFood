/**
 * Paquet de cartes du menu (maquette) : une carte par catégorie, empilées ; la carte de devant
 * montre les options, les autres dépassent derrière. Puces, glissement et clic changent de carte.
 */

import { useRef, type PointerEvent } from 'react';
import type { CatalogItemWithOptionId } from '@meal-app/shared';
import { Icon } from '../../components/ui/Icon';

export type CategoryKey = 'plat' | 'accompagnement' | 'viande';

export interface DeckCard {
  key: CategoryKey;
  title: string;
  options: CatalogItemWithOptionId[];
  selected: number | null;
  /** Libellé en italique en haut de la carte (« choisi », « en cuisine »…) */
  tag: string;
  tagTone: 'accent' | 'muted' | 'danger';
  /** Catégorie non incluse aujourd'hui (viande hors formule) */
  offNote?: string;
}

const PEEK = 20;
const OPTION_HEIGHT = 76;

export function MenuDeck({
  cards,
  active,
  onActiveChange,
  onPick,
  locked,
  dimmed,
}: {
  cards: DeckCard[];
  active: number;
  onActiveChange: (index: number) => void;
  onPick: (key: CategoryKey, optionId: number) => void;
  locked: boolean;
  dimmed: boolean;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const count = cards.length;
  const peeks = Math.min(count - 1, 3);
  const maxOptions = Math.max(2, ...cards.map((card) => (card.offNote ? 1 : card.options.length)));
  const cardHeight = 46 + OPTION_HEIGHT * maxOptions;

  const step = (delta: number) => onActiveChange((((active + delta) % count) + count) % count);

  const onPointerDown = (event: PointerEvent) => {
    start.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dy) >= Math.abs(dx) && Math.abs(dy) > 36) step(dy < 0 ? 1 : -1);
    else if (Math.abs(dx) > 36) step(dx < 0 ? 1 : -1);
  };

  const tagColor = { accent: 'text-accent-strong', muted: 'text-ink-soft', danger: 'text-danger' };

  return (
    <div className="flex flex-col gap-4 select-none" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <div role="tablist" aria-label="Sections du menu" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {cards.map((card, index) => {
          const front = index === active;
          return (
            <button
              key={card.key}
              type="button"
              role="tab"
              aria-selected={front}
              onClick={() => onActiveChange(index)}
              className={`press flex h-[38px] flex-none items-center gap-2 whitespace-nowrap rounded-full px-[18px] text-sm font-semibold ${
                front ? 'bg-ink text-page' : 'border border-line/[0.08] bg-ink/[0.06] text-ink-soft'
              }`}
            >
              {card.title}
            </button>
          );
        })}
      </div>

      <div className="relative" style={{ height: peeks * PEEK + cardHeight, touchAction: 'pan-x' }}>
        {cards.map((card, index) => {
          const depth = (index - active + count) % count;
          const level = Math.min(depth, 3);
          const front = depth === 0;
          const top = front ? peeks * PEEK : (peeks - Math.min(level, peeks)) * PEEK;
          const opacity = [1, 0.8, 0.52, 0.3][level] ?? 0;

          return (
            <section
              key={card.key}
              aria-hidden={!front}
              onClick={front ? undefined : () => onActiveChange(index)}
              className={`absolute inset-x-0 flex flex-col gap-3 overflow-hidden rounded-4xl border border-line/[0.12] p-4 transition-[top,transform,opacity,filter] duration-[450ms] [transition-timing-function:cubic-bezier(.3,.8,.3,1)] ${
                front ? 'bg-[linear-gradient(180deg,rgb(var(--c-surface))_0%,rgb(var(--c-card))_100%)]' : 'cursor-pointer bg-card'
              }`}
              style={{
                top,
                height: cardHeight,
                transformOrigin: '50% 0',
                transform: `scale(${front ? 1 : 1 - 0.06 * level})`,
                opacity,
                filter: `blur(${front ? 0 : level * 0.7}px)`,
                zIndex: 50 - depth,
              }}
            >
              <span className={`font-serif text-[14px] italic lowercase leading-4 tracking-[0.02em] ${tagColor[card.tagTone]}`}>
                {card.tag}
              </span>

              {card.offNote ? (
                <p className="py-1 text-[14px] leading-[1.45] text-ink-soft">{card.offNote}</p>
              ) : (
                card.options.map((option) => {
                  const selected = option.optionId === card.selected;
                  return (
                    <button
                      key={option.optionId}
                      type="button"
                      tabIndex={front ? 0 : -1}
                      aria-pressed={selected}
                      disabled={locked}
                      onClick={(event) => {
                        event.stopPropagation();
                        onPick(card.key, option.optionId);
                      }}
                      className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-[22px] border px-3.5 py-2 text-left transition-[background,border-color,transform] duration-300 ${
                        selected
                          ? `border-transparent text-ink ${dimmed ? 'bg-ink/[0.06]' : 'bg-accent/[0.12]'}`
                          : 'border-line/10 bg-surface text-ink-soft'
                      } ${locked ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}`}
                    >
                      <span className="text-[15px] font-medium">{option.nom}</span>
                      <span
                        className={`flex h-6 w-6 flex-none items-center justify-center rounded-full transition-colors ${
                          selected ? (dimmed ? 'bg-ink text-page' : 'bg-accent text-on-accent') : 'border-[1.5px] border-ink/30'
                        }`}
                      >
                        {selected && <Icon name="check" size={14} strokeWidth={2.6} />}
                      </span>
                    </button>
                  );
                })
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
