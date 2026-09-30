/**
 * « Menu » : le menu du jour et la commande du client (SPEC 5.6 à 5.9, 7).
 *
 * États de la maquette : normal · en retard · verrouillé · commande par défaut reçue · annulée ·
 * abonnement expiré. L'annulation est possible même sans commande (le client refuse alors le repas
 * par défaut) et reste réversible jusqu'à 20h00.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  LOCK_TIME,
  OrderStatus,
  SubscriptionPlan,
  type ClientDailyMenuView,
} from '@meal-app/shared';
import { clientApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useClientArea, ClientShell } from './ClientArea';
import { MenuDeck, type CategoryKey, type DeckCard } from './MenuDeck';
import { ReviewCard } from './ReviewCard';
import { Button } from '../../components/ui/Button';
import { Sheet, SheetActions } from '../../components/ui/Sheet';
import { EmptyState, ErrorState, Notice, SectionLoader } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { useTicker } from '../../hooks/useApi';
import {
  formatCountdown,
  formatDayMonth,
  formatLongDate,
  formatTime,
  kinshasaClock,
  timeToSeconds,
} from '../../lib/format';

type Picks = Partial<Record<CategoryKey, number>>;

type MenuState = 'aucun_menu' | 'non_commence' | 'expire' | 'annule' | 'defaut' | 'verrouille' | 'en_retard' | 'normal';

function menuState(menu: ClientDailyMenuView, resuming: boolean): MenuState {
  const order = menu.commandeExistante;
  if (menu.etatAbonnement === 'expire') return 'expire';
  if (menu.etatAbonnement === 'non_commence') return 'non_commence';
  if (menu.statutMenu === 'aucun_menu') return 'aucun_menu';
  if (order?.statut === OrderStatus.ANNULEE && !(resuming && menu.statutMenu !== 'verrouille')) return 'annule';
  if (menu.statutMenu === 'verrouille') return order?.estDefaut ? 'defaut' : 'verrouille';
  return menu.statutMenu === 'en_retard' ? 'en_retard' : 'normal';
}

const HEADLINES: Record<MenuState, string> = {
  normal: 'Fais-toi plaisir.',
  en_retard: 'Encore un instant.',
  verrouille: 'Ton repas se prépare.',
  defaut: 'On a choisi pour toi.',
  annule: 'Pas de repas ce jour.',
  expire: 'À très bientôt.',
  non_commence: 'On t\'attend à table.',
  aucun_menu: 'Le menu arrive bientôt.',
};

function initialPicks(menu: ClientDailyMenuView): Picks {
  const order = menu.commandeExistante;
  if (!order || order.statut === OrderStatus.ANNULEE) return {};
  return {
    plat: order.platId ?? undefined,
    accompagnement: order.accompagnementId ?? undefined,
    viande: order.viandeId ?? undefined,
  };
}

/** Compte à rebours de l'en-tête (vers l'heure limite, puis vers 20h00) */
function Countdown({ menu, state, serverOffset }: { menu: ClientDailyMenuView; state: MenuState; serverOffset: number }) {
  const now = useTicker();
  const [tipOpen, setTipOpen] = useState(false);
  const clock = kinshasaClock(new Date(now + serverOffset));
  const deadline = menu.dailyOffer?.heureLimiteIndicative ?? '13:00';
  const live = state === 'normal' || state === 'en_retard' || state === 'annule';
  const target = timeToSeconds(state === 'normal' ? deadline : LOCK_TIME);
  const left = clock.date === menu.date ? target - clock.seconds : 0;

  const label = {
    normal: 'la table est ouverte',
    en_retard: 'encore un instant',
    annule: 'annulé',
    verrouille: 'en cuisine',
    defaut: 'choisi pour toi',
    expire: 'à bientôt',
    non_commence: 'bientôt',
    aucun_menu: 'en préparation',
  }[state];

  const tip =
    state === 'normal'
      ? `Voici le temps qu'il te reste pour composer ton repas avant ${formatTime(deadline)}.`
      : state === 'en_retard' || state === 'annule'
        ? `Tu peux encore changer d'avis jusqu'à 20h00. Après, le menu est verrouillé.`
        : 'Les commandes du jour sont verrouillées depuis 20h00.';

  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <button
        type="button"
        role="timer"
        aria-label="Compte à rebours, appuie pour comprendre"
        onClick={() => setTipOpen((v) => !v)}
        className={`flex h-11 flex-col items-center justify-center whitespace-nowrap px-2 text-center font-serif text-[22px] leading-none tabular-nums ${
          state === 'en_retard' ? 'text-danger' : 'text-accent'
        } ${live && left > 0 && left <= 1800 ? 'pulse-soft' : ''}`}
      >
        {live && left > 0 ? formatCountdown(left) : '--:--:--'}
        <span className={`mt-0.5 block font-serif text-[13px] italic lowercase leading-none tracking-[0.02em] ${state === 'annule' ? 'text-danger' : ''}`}>
          {label}
        </span>
      </button>
      {tipOpen && (
        <button
          type="button"
          onClick={() => setTipOpen(false)}
          className="a-drop absolute left-1/2 top-14 z-30 w-[300px] -translate-x-1/2 rounded-[18px] bg-ink px-4 py-3.5 text-left text-[13px] leading-[1.45] text-page"
        >
          <span className="mb-0.5 block text-[14px] font-bold">Le temps file</span>
          {tip}
        </button>
      )}
    </div>
  );
}

export function MenuPage() {
  const { menu, refreshAll } = useClientArea();
  const toast = useToast();
  const data = menu.data;

  const [picks, setPicks] = useState<Picks>({});
  const [active, setActive] = useState(0);
  const [resuming, setResuming] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Réinitialise la sélection quand la commande enregistrée change
  const orderSignature = data?.commandeExistante
    ? `${data.commandeExistante.id}-${data.commandeExistante.updatedAt}`
    : 'aucune';
  useEffect(() => {
    if (data) setPicks(initialPicks(data));
  }, [orderSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const serverOffset = useMemo(() => (data ? Date.parse(data.serverNow) - Date.now() : 0), [data]);

  if (menu.loading && !data) {
    return (
      <ClientShell title="Menu" photo="/images/photo-menu.jpg">
        <SectionLoader />
      </ClientShell>
    );
  }
  if (!data) {
    return (
      <ClientShell title="Menu" photo="/images/photo-menu.jpg">
        <ErrorState message={menu.error?.message ?? 'Menu indisponible.'} onRetry={() => void menu.reload()} />
      </ClientShell>
    );
  }

  const state = menuState(data, resuming);
  const editable = state === 'normal' || state === 'en_retard';
  const dimmed = !editable;
  const saved = initialPicks(data);
  const meatIncluded = data.estViandeAutoriseeAujourdhui && data.optionsParCategorie.viandes.length > 0;
  const formuleOne = data.formule === SubscriptionPlan.PLAN_25000;

  const requiredKeys: CategoryKey[] = meatIncluded ? ['plat', 'accompagnement', 'viande'] : ['plat', 'accompagnement'];
  const complete = requiredKeys.every((key) => picks[key] !== undefined);
  const hasActiveOrder = Boolean(data.commandeExistante) && data.commandeExistante?.statut !== OrderStatus.ANNULEE;
  const unchanged = hasActiveOrder && requiredKeys.every((key) => picks[key] === saved[key]);

  const cardTag = (key: CategoryKey): Pick<DeckCard, 'tag' | 'tagTone'> => {
    switch (state) {
      case 'annule':
        return { tag: 'annulé', tagTone: 'danger' };
      case 'expire':
        return { tag: 'terminé', tagTone: 'muted' };
      case 'defaut':
        return { tag: 'choisi pour toi', tagTone: 'muted' };
      case 'verrouille':
        return { tag: 'en cuisine', tagTone: 'muted' };
      default:
        return picks[key] !== undefined ? { tag: 'choisi', tagTone: 'accent' } : { tag: 'à toi de choisir', tagTone: 'muted' };
    }
  };

  const showSelection = state !== 'annule' && state !== 'expire';
  const cards: DeckCard[] = [
    { key: 'plat', title: 'Plat', options: data.optionsParCategorie.plats },
    { key: 'accompagnement', title: 'Accompagnement', options: data.optionsParCategorie.accompagnements },
    { key: 'viande', title: 'Viande', options: data.optionsParCategorie.viandes },
  ].map((card) => {
    const key = card.key as CategoryKey;
    const off = key === 'viande' && !meatIncluded;
    return {
      ...card,
      key,
      selected: showSelection ? picks[key] ?? null : null,
      ...(off
        ? {
            tag: "pas aujourd'hui",
            tagTone: 'muted' as const,
            offNote: formuleOne
              ? 'Ta Formule 1 réserve la viande au lundi et au vendredi.'
              : "Pas de viande au menu aujourd'hui.",
          }
        : cardTag(key)),
    };
  });

  const pick = (key: CategoryKey, optionId: number) => {
    if (!editable) return;
    setError(null);
    const next = { ...picks, [key]: optionId };
    setPicks(next);
    // Passe à la catégorie suivante encore à choisir
    const nextIndex = cards.findIndex((card) => !card.offNote && next[card.key] === undefined);
    if (nextIndex >= 0) window.setTimeout(() => setActive(nextIndex), 320);
  };

  const confirm = async () => {
    if (!data.dailyOffer || !complete) {
      setError('Choisis un plat, un accompagnement' + (meatIncluded ? ' et une viande.' : '.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await clientApi.submitOrder({
        dailyOfferId: data.dailyOffer.id,
        platOptionId: picks.plat as number,
        accompagnementOptionId: picks.accompagnement as number,
        viandeOptionId: meatIncluded ? (picks.viande as number) : null,
      });
      setResuming(false);
      toast.show("C'est noté, bon appétit !");
      await refreshAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible, réessaie.');
      void menu.reload(true);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!data.dailyOffer) return;
    setSaving(true);
    setError(null);
    try {
      await clientApi.cancelOrder(data.dailyOffer.id);
      setConfirmCancel(false);
      setResuming(false);
      toast.show('Repas annulé pour aujourd\'hui');
      await refreshAll();
    } catch (err) {
      setConfirmCancel(false);
      setError(err instanceof ApiError ? err.message : 'Annulation impossible, réessaie.');
    } finally {
      setSaving(false);
    }
  };

  const notice = (() => {
    switch (state) {
      case 'en_retard':
        return <Notice icon="hourglass" tone="warn" title="En retard">Choix possible jusqu'à 20h00.</Notice>;
      case 'verrouille':
        return <Notice icon="lock" tone="success" title="Menu verrouillé">Commande prise en compte.</Notice>;
      case 'defaut':
        return (
          <Notice icon="wand" title="Attribué automatiquement">
            Aucun choix reçu : on t'a servi les plats les plus demandés.
          </Notice>
        );
      case 'annule':
        return (
          <Notice icon="x" tone="danger" title="Commande annulée">
            Exclue de la préparation.
            {data.statutMenu !== 'verrouille' ? ' Tu peux encore changer d\'avis jusqu\'à 20h00.' : ''}
          </Notice>
        );
      case 'expire':
        return (
          <Notice icon="calendar" tone="danger" title="Abonnement expiré">
            Terminé le {formatDayMonth(data.dateFinAbonnement)}. Contacte l'administratrice pour le renouveler.
          </Notice>
        );
      default:
        return null;
    }
  })();

  const primary = (() => {
    if (state === 'expire') return <Button variant="quiet" disabled>Abonnement terminé</Button>;
    if (state === 'annule') return <Button variant="quiet" disabled>Repas annulé</Button>;
    if (state === 'verrouille' || state === 'defaut') return <Button variant="quiet" disabled>Bon appétit</Button>;
    if (unchanged) {
      return (
        <Button variant="quiet" icon="check" disabled>
          Repas confirmé
        </Button>
      );
    }
    return (
      <Button onClick={confirm} loading={saving} disabled={!complete}>
        {hasActiveOrder ? 'Modifier mon repas' : 'Confirmer mon repas'}
      </Button>
    );
  })();

  return (
    <ClientShell title="Menu" photo="/images/photo-menu.jpg" center={<Countdown menu={data} state={state} serverOffset={serverOffset} />}>
      <div className="a-rise d2 mt-5 flex flex-col gap-2">
        <p className="text-lg font-semibold leading-tight text-ink">Au menu {formatLongDate(data.date)}.</p>
        <h1 className="font-serif text-[42px] leading-[1.05] tracking-[-0.01em] text-ink [text-wrap:balance]">
          {HEADLINES[state]}
        </h1>
      </div>

      {notice && <div className="a-rise d3 mt-5">{notice}</div>}

      {state === 'aucun_menu' || state === 'non_commence' ? (
        <EmptyState icon="dish" title={state === 'aucun_menu' ? 'Pas encore de menu' : 'Encore un peu de patience'}>
          {state === 'aucun_menu'
            ? "L'administratrice n'a pas encore publié le menu du jour. Reviens un peu plus tard."
            : 'Ton abonnement n\'a pas encore commencé.'}
        </EmptyState>
      ) : (
        <>
          <div className="a-rise d3 mt-6">
            <MenuDeck
              cards={cards}
              active={active}
              onActiveChange={setActive}
              onPick={pick}
              locked={!editable}
              dimmed={dimmed}
            />
          </div>

          <div className="a-rise d5 flex flex-col gap-2 pt-7">
            {error && <p role="alert" className="px-1 pb-1 text-[13px] text-danger">{error}</p>}
            {primary}
            {editable && (
              <Button variant="soft" onClick={() => setConfirmCancel(true)}>
                Annuler mon repas
              </Button>
            )}
            {state === 'annule' && data.statutMenu !== 'verrouille' && (
              <Button
                variant="soft"
                onClick={() => {
                  setResuming(true);
                  setPicks({});
                  setActive(0);
                }}
              >
                Finalement, je mange
              </Button>
            )}
          </div>
        </>
      )}

      {data.avisRepasPrecedentACompleter && (
        <ReviewCard
          key={data.avisRepasPrecedentACompleter.orderId}
          orderId={data.avisRepasPrecedentACompleter.orderId}
          date={data.avisRepasPrecedentACompleter.date}
          dimmed={state === 'expire'}
          onSent={() => void refreshAll()}
        />
      )}

      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Annuler ton repas ?"
        subtitle="Tu ne seras pas livré aujourd'hui. Tu peux changer d'avis jusqu'à 20h00."
      >
        <SheetActions>
          <Button variant="primary" onClick={cancel} loading={saving}>
            Oui, pas de repas aujourd'hui
          </Button>
          <Button variant="outline" onClick={() => setConfirmCancel(false)}>
            Garder mon repas
          </Button>
        </SheetActions>
      </Sheet>
    </ClientShell>
  );
}
