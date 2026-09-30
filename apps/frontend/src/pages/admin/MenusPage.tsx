/**
 * « Compose le menu de demain. » (SPEC 5.5) : publication d'un jour ou de plusieurs jours ouvrés,
 * liste des menus à venir, chacun restant modifiable jusqu'à son verrouillage.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ItemCategory, addDays, type AdminOfferView, type CatalogItemView, type WeekDayView } from '@meal-app/shared';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { AdminPage } from './AdminArea';
import { Chips, PickChip, SectionTitle } from '../../components/ui/Controls';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Field';
import { Sheet, SheetActions } from '../../components/ui/Sheet';
import { EmptyState, ErrorState, FormError, SectionLoader } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { nextWorkingDay, workingDays } from '../../lib/calendar';
import {
  capitalize,
  dayNumber,
  formatFullDate,
  formatShortDate,
  formatTime,
  formatWeekdayShort,
  kinshasaClock,
  plural,
  todayKinshasa,
} from '../../lib/format';

const HORIZON_DAYS = 28;
const CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: ItemCategory.PLAT, label: 'Plat' },
  { key: ItemCategory.ACCOMPAGNEMENT, label: 'Accompagnement' },
  { key: ItemCategory.VIANDE, label: 'Viande' },
];

const DEADLINES = Array.from({ length: 17 }, (_, i) => {
  const minutes = 11 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

/** Sélection de plats par catégorie, en puces (maquette) */
function DishPicker({
  catalog,
  selected,
  onChange,
}: {
  catalog: CatalogItemView[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {CATEGORIES.map((category) => {
        const items = catalog.filter((item) => item.categorie === category.key);
        const count = items.filter((item) => selected.includes(item.id)).length;
        return (
          <section key={category.key} className="rounded-4xl border border-line/[0.08] bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-ink">{category.label}</h3>
              <span className={`text-[12px] ${count === 0 ? 'font-semibold text-danger' : 'text-ink-soft'}`}>
                {count === 0 ? 'aucun choisi' : plural(count, 'choisi', 'choisis')}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {items.length === 0 && <span className="text-[13px] text-muted">Aucun plat actif dans cette catégorie.</span>}
              {items.map((item) => {
                const on = selected.includes(item.id);
                return (
                  <PickChip key={item.id} selected={on} onClick={() => onChange(on ? selected.filter((id) => id !== item.id) : [...selected, item.id])}>
                    {item.nom}
                  </PickChip>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function missingCategory(catalog: CatalogItemView[], selected: number[]): string | null {
  for (const category of CATEGORIES) {
    if (!catalog.some((item) => item.categorie === category.key && selected.includes(item.id))) {
      return `Choisis au moins un ${category.label.toLowerCase()}.`;
    }
  }
  return null;
}

function offerSummary(offer: AdminOfferView): { main: string; sides: string } {
  return {
    main: offer.plats.map((p) => p.nom).join(', '),
    sides: [...offer.accompagnements, ...offer.viandes].map((p) => p.nom).join(' · '),
  };
}

function EditOfferSheet({
  day,
  catalog,
  onClose,
  onSaved,
}: {
  day: WeekDayView | null;
  catalog: CatalogItemView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const offer = day?.offre;
  const [selected, setSelected] = useState<number[]>([]);
  const [deadline, setDeadline] = useState('13:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!offer) return;
    setSelected([...offer.plats, ...offer.accompagnements, ...offer.viandes].map((o) => o.catalogItemId));
    setDeadline(offer.heureLimiteIndicative);
    setError(null);
  }, [offer]);

  // Les plats déjà au menu restent affichés même s'ils ont été désactivés depuis
  const pickable = useMemo(() => {
    const onMenu = new Set(selected);
    return catalog.filter((item) => item.actif || onMenu.has(item.id));
  }, [catalog, selected]);

  const save = async () => {
    if (!day) return;
    const missing = missingCategory(pickable, selected);
    if (missing) {
      setError(missing);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateOffer(day.date, { catalogItemIds: selected, heureLimiteIndicative: deadline });
      toast.show('Menu mis à jour');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Modification impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={Boolean(day && offer)}
      onClose={onClose}
      title="Modifier le menu"
      subtitle={day ? `${capitalize(formatFullDate(day.date))}. Modifiable jusqu'à 20h00 le jour même.` : undefined}
    >
      <DishPicker catalog={pickable} selected={selected} onChange={setSelected} />
      <SelectField className="mt-4" label="Heure limite indicative" icon="clock" value={deadline} onChange={(e) => setDeadline(e.target.value)}>
        {DEADLINES.map((time) => (
          <option key={time} value={time}>
            {formatTime(time)}
          </option>
        ))}
      </SelectField>
      <div className="mt-3">
        <FormError>{error}</FormError>
      </div>
      <SheetActions>
        <Button icon="check" onClick={save} loading={saving}>
          Enregistrer
        </Button>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
      </SheetActions>
    </Sheet>
  );
}

export function MenusPage() {
  const today = todayKinshasa();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const catalog = useApi(() => adminApi.catalog(), []);
  const offers = useApi(() => adminApi.offers(today, addDays(today, HORIZON_DAYS)), [today]);

  const activeCatalog = useMemo(() => (catalog.data ?? []).filter((item) => item.actif), [catalog.data]);
  const days = useMemo(() => offers.data ?? [], [offers.data]);

  // Aujourd'hui n'est publiable qu'avant 20h00
  const beforeLock = kinshasaClock().seconds < 20 * 3600;
  const freeDays = days.filter((day) => !day.publie && (day.date > today || (day.date === today && beforeLock)));
  const upcoming = days.filter((day) => day.publie && day.offre?.statut === 'ouvert');

  const requested = params.get('date');
  const [date, setDate] = useState('');
  const [deadline, setDeadline] = useState('13:00');
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [dayCount, setDayCount] = useState(3);
  const [editing, setEditing] = useState<WeekDayView | null>(null);

  // Date par défaut : celle demandée (si libre), sinon le prochain jour sans menu
  useEffect(() => {
    if (!days.length) return;
    const requestedDay = days.find((day) => day.date === requested);
    if (requestedDay?.publie && requestedDay.offre?.statut === 'ouvert') {
      setEditing(requestedDay);
    }
    const free = freeDays.map((day) => day.date);
    if (!free.includes(date)) {
      const tomorrow = nextWorkingDay(today);
      setDate(free.find((d) => d === requested) ?? free.find((d) => d >= tomorrow) ?? free[0] ?? '');
    }
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const tomorrow = nextWorkingDay(today);
  const title = date === tomorrow || !date ? 'Compose le menu de demain.' : date === today ? "Compose le menu d'aujourd'hui." : `Compose le menu du ${formatShortDate(date).replace(/\.$/, '')}.`;

  const multiDays = date ? workingDays(date, dayCount) : [];
  const alreadyPublished = new Set(days.filter((day) => day.publie).map((day) => day.date));
  const copiedMenu = activeCatalog.filter((item) => selected.includes(item.id)).map((item) => item.nom).join(', ');

  const validate = (): boolean => {
    const missing = missingCategory(activeCatalog, selected);
    if (!date) {
      setError('Aucun jour libre à publier dans les prochaines semaines.');
      return false;
    }
    if (missing) {
      setError(missing);
      return false;
    }
    setError(null);
    return true;
  };

  const afterPublish = async (message: string) => {
    toast.show(message);
    setSelected([]);
    setMultiOpen(false);
    setParams({}, { replace: true });
    await offers.reload(true);
  };

  const publishOne = async () => {
    if (!validate()) return;
    setPublishing(true);
    try {
      await adminApi.publishSingle({ date, heureLimiteIndicative: deadline, catalogItemIds: selected });
      await afterPublish(`Menu du ${formatShortDate(date)} publié`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  const publishMany = async () => {
    if (!validate()) {
      setMultiOpen(false);
      return;
    }
    setPublishing(true);
    try {
      const result = await adminApi.publishMulti({ dateDebut: date, nombreJours: dayCount, heureLimiteIndicative: deadline, catalogItemIds: selected });
      await afterPublish(
        result.ignores.length
          ? `${plural(result.dates.length, 'menu publié', 'menus publiés')}, ${result.ignores.length} déjà prêt${result.ignores.length > 1 ? 's' : ''}`
          : `${plural(result.dates.length, 'menu publié', 'menus publiés')}`
      );
    } catch (err) {
      setMultiOpen(false);
      setError(err instanceof ApiError ? err.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  const loading = (catalog.loading && !catalog.data) || (offers.loading && !offers.data);
  const failure = catalog.error ?? offers.error;

  return (
    <AdminPage title={title}>
      {loading ? (
        <SectionLoader />
      ) : failure ? (
        <ErrorState message={failure.message} onRetry={() => void Promise.all([catalog.reload(), offers.reload()])} />
      ) : (
        <>
          <div className="a-rise d2 flex flex-col gap-4">
            <SelectField label="Date du menu" icon="calendar" value={date} onChange={(e) => setDate(e.target.value)} hint="Publié la veille pour le lendemain.">
              {freeDays.length === 0 && <option value="">Aucun jour libre</option>}
              {freeDays.map((day) => (
                <option key={day.date} value={day.date}>
                  {capitalize(formatFullDate(day.date))}
                </option>
              ))}
            </SelectField>
            <SelectField label="Heure limite indicative" icon="clock" value={deadline} onChange={(e) => setDeadline(e.target.value)} hint="Verrouillage définitif à 20h00.">
              {DEADLINES.map((time) => (
                <option key={time} value={time}>
                  {formatTime(time)}
                </option>
              ))}
            </SelectField>
          </div>

          <SectionTitle className="a-rise d3 mb-1.5 mt-6">Le menu du jour</SectionTitle>
          <p className="a-rise d3 mb-3 text-[13px] leading-snug text-ink-soft">
            Coche autant de plats que tu veux dans chaque catégorie. Seuls les plats activés de ta carte apparaissent.
          </p>
          <div className="a-rise d4">
            <DishPicker catalog={activeCatalog} selected={selected} onChange={setSelected} />
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <FormError>{error}</FormError>
            <Button icon="check" onClick={publishOne} loading={publishing && !multiOpen} disabled={!date}>
              Publier
            </Button>
            <Button variant="soft" icon="calendar" disabled={!date} onClick={() => validate() && setMultiOpen(true)}>
              Publier pour plusieurs jours
            </Button>
          </div>

          <SectionTitle className="mb-2 mt-8">Menus à venir</SectionTitle>
          {upcoming.length === 0 ? (
            <EmptyState icon="calendar" title="Aucun menu à venir" />
          ) : (
            <ul className="flex flex-col">
              {upcoming.map((day) => {
                const summary = offerSummary(day.offre as AdminOfferView);
                return (
                  <li key={day.date} className="flex items-center gap-3 border-b border-line/[0.06] py-3 last:border-0">
                    <span className="flex w-10 flex-none flex-col items-center">
                      <span className="text-[18px] font-bold leading-none tabular-nums text-ink">{dayNumber(day.date)}</span>
                      <span className="text-[12px] text-muted">{formatWeekdayShort(day.date)}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold text-ink">{summary.main}</span>
                      <span className="truncate text-[13px] text-ink-soft">{summary.sides}</span>
                      <span className="text-[12px] text-muted">
                        Limite {formatTime(day.offre?.heureLimiteIndicative ?? '13:00')} · {plural(day.livraisonsPrevues, 'livraison prévue', 'livraisons prévues')}
                      </span>
                    </span>
                    <Button variant="soft" size="sm" block={false} onClick={() => setEditing(day)}>
                      Modifier
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <Sheet open={multiOpen} onClose={() => setMultiOpen(false)} title="Plusieurs jours" subtitle="Le même menu est copié sur les jours choisis.">
        <Chips
          label="Nombre de jours"
          value={String(dayCount)}
          onChange={(value) => setDayCount(Number(value))}
          options={[2, 3, 4, 5, 10].map((n) => ({ value: String(n), label: `${n} jours` }))}
        />
        <span className="mb-2 ml-1.5 mt-4 text-[13px] font-semibold text-ink-soft">Jours concernés</span>
        <div className="flex flex-wrap gap-2">
          {multiDays.map((day) => {
            const taken = alreadyPublished.has(day);
            return (
              <span
                key={day}
                className={`inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold ${
                  taken ? 'bg-ink/[0.06] text-muted line-through' : 'bg-field text-accent-strong'
                }`}
                title={taken ? 'Déjà un menu ce jour-là : il ne sera pas remplacé' : undefined}
              >
                {formatShortDate(day)}
              </span>
            );
          })}
        </div>
        <p className="ml-1.5 mt-2 text-[12px] text-muted">
          Du lundi au vendredi, le week-end est sauté.
          {multiDays.some((d) => alreadyPublished.has(d)) ? ' Les jours barrés ont déjà un menu et ne changent pas.' : ''}
        </p>
        <div className="mt-4 rounded-4xl border border-line/[0.08] bg-card p-4">
          <p className="text-[13px] text-ink-soft">Menu copié</p>
          <p className="mt-1 text-[15px] leading-snug text-ink">{copiedMenu}</p>
        </div>
        <p className="mt-3 text-[13px] text-ink-soft">Chaque jour reste modifiable ensuite, un par un.</p>
        <SheetActions>
          <Button icon="check" onClick={publishMany} loading={publishing}>
            Publier sur {dayCount} jours
          </Button>
          <Button variant="outline" onClick={() => setMultiOpen(false)}>
            Annuler
          </Button>
        </SheetActions>
      </Sheet>

      <EditOfferSheet
        day={editing}
        catalog={catalog.data ?? []}
        onClose={() => {
          setEditing(null);
          if (params.get('date')) setParams({}, { replace: true });
        }}
        onSaved={() => void offers.reload(true)}
      />
    </AdminPage>
  );
}
