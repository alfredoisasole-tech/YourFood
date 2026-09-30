/**
 * « Ta carte, prête à servir. » (SPEC 5.4) : plats par catégorie, ajout, modification,
 * désactivation et suppression (bloquée si le plat est sur un menu non verrouillé).
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ItemCategory, type CatalogItemView } from '@meal-app/shared';
import { adminApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { AdminPage } from './AdminArea';
import { Chips, Toggle } from '../../components/ui/Controls';
import { Button, IconButton } from '../../components/ui/Button';
import { Field, FieldLabel } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { Sheet, SheetActions } from '../../components/ui/Sheet';
import { EmptyState, ErrorState, FormError, SectionLoader } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { nextWorkingDay } from '../../lib/calendar';
import { formatShortDate, formatLongDate, plural, todayKinshasa } from '../../lib/format';

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  [ItemCategory.PLAT]: 'Plat',
  [ItemCategory.ACCOMPAGNEMENT]: 'Accompagnement',
  [ItemCategory.VIANDE]: 'Viande',
};

const CATEGORIES = Object.values(ItemCategory);

function menuHint(item: CatalogItemView, today: string): string | null {
  const next = item.prochainsMenus.find((date) => date >= today);
  if (!next) return null;
  if (next === today) return "sur le menu d'aujourd'hui";
  if (next === nextWorkingDay(today)) return 'sur le menu de demain';
  return `sur le menu du ${formatShortDate(next)}`;
}

type Dialog =
  | { kind: 'new' }
  | { kind: 'edit'; item: CatalogItemView }
  | { kind: 'confirm-delete'; item: CatalogItemView }
  | { kind: 'blocked'; item: CatalogItemView; date: string }
  | { kind: 'deleted'; name: string; remaining: number };

function DishForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel,
}: {
  initial: { nom: string; categorie: ItemCategory; actif: boolean };
  onSubmit: (values: { nom: string; categorie: ItemCategory; actif: boolean }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  submitLabel: string;
}) {
  const [nom, setNom] = useState(initial.nom);
  const [categorie, setCategorie] = useState(initial.categorie);
  const [actif, setActif] = useState(initial.actif);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!nom.trim()) {
      setError('Donne un nom au plat.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ nom: nom.trim(), categorie, actif });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Nom" icon="dish" placeholder="Ex. Poulet moambe" value={nom} onChange={(e) => setNom(e.target.value)} />
      <div>
        <FieldLabel>Catégorie</FieldLabel>
        <Chips
          label="Catégorie"
          value={categorie}
          onChange={setCategorie}
          options={CATEGORIES.map((value) => ({ value, label: CATEGORY_LABEL[value] }))}
        />
      </div>
      <div className="flex items-center gap-4 rounded-[22px] bg-field px-4 py-3.5">
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold text-ink">Proposé sur la carte</span>
          <span className="text-[12px] leading-snug text-ink-soft">Désactivé, il disparaît des prochains menus.</span>
        </span>
        <Toggle checked={actif} onChange={setActif} label="Proposé sur la carte" />
      </div>
      <FormError>{error}</FormError>
      <SheetActions>
        <Button type="submit" icon="check" loading={saving}>
          {submitLabel}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        {onDelete && (
          <Button variant="ghost" icon="trash" onClick={onDelete} className="!text-danger">
            Supprimer le plat
          </Button>
        )}
      </SheetActions>
    </form>
  );
}

export function CatalogPage() {
  const today = todayKinshasa();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const catalog = useApi(() => adminApi.catalog(), []);
  const [category, setCategory] = useState<ItemCategory>(ItemCategory.PLAT);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (params.get('nouveau') === '1') {
      setDialog({ kind: 'new' });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const items = catalog.data ?? [];
  const visible = items.filter((item) => item.categorie === category);
  const close = () => setDialog(null);

  const toggle = async (item: CatalogItemView, actif: boolean) => {
    setBusy(item.id);
    try {
      const result = await adminApi.updateDish(item.id, { actif });
      catalog.setData((current) => current?.map((i) => (i.id === item.id ? result.item : i)) ?? null);
      if (!actif && result.menusRetires.length > 0) {
        toast.show(`Retiré de ${plural(result.menusRetires.length, 'menu à venir', 'menus à venir')}`);
      } else {
        toast.show(actif ? `« ${item.nom} » est de retour` : `« ${item.nom} » désactivé`);
      }
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Action impossible', 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item: CatalogItemView) => {
    try {
      const { restants } = await adminApi.deleteDish(item.id);
      setDialog({ kind: 'deleted', name: item.nom, remaining: restants });
      void catalog.reload(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const details = err.details as { date?: string } | undefined;
        setDialog({ kind: 'blocked', item, date: details?.date ?? today });
      } else {
        toast.show(err instanceof ApiError ? err.message : 'Suppression impossible', 'error');
        close();
      }
    }
  };

  return (
    <AdminPage title="Ta carte, prête à servir.">
      <Chips
        className="a-rise d2"
        label="Catégories"
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((value) => ({
          value,
          label: CATEGORY_LABEL[value],
          count: items.filter((item) => item.categorie === value).length,
        }))}
      />

      <div className="mt-4">
        {catalog.loading && !catalog.data ? (
          <SectionLoader />
        ) : catalog.error ? (
          <ErrorState message={catalog.error.message} onRetry={() => void catalog.reload()} />
        ) : visible.length === 0 ? (
          <EmptyState icon="dish" title="Rien dans cette catégorie" />
        ) : (
          <ul className="a-rise d3 flex flex-col">
            {visible.map((item) => {
              const hint = item.actif ? menuHint(item, today) : 'désactivé';
              return (
                <li key={item.id} className="flex items-center gap-2 border-b border-line/[0.06] py-3 last:border-0">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate text-[15px] font-semibold ${item.actif ? 'text-ink' : 'text-muted'}`}>{item.nom}</span>
                    {hint && <span className={`font-serif text-[14px] italic ${item.actif ? 'text-accent-strong' : 'text-muted'}`}>{hint}</span>}
                  </span>
                  <IconButton icon="pencil" label={`Modifier ${item.nom}`} size={36} onClick={() => setDialog({ kind: 'edit', item })} />
                  <Toggle checked={item.actif} onChange={(value) => void toggle(item, value)} label={`Proposer ${item.nom}`} disabled={busy === item.id} />
                  <IconButton icon="trash" label={`Supprimer ${item.nom}`} variant="plain" size={36} className="!text-danger" onClick={() => setDialog({ kind: 'confirm-delete', item })} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Button variant="soft" icon="plus" className="a-rise d4 mt-5" onClick={() => setDialog({ kind: 'new' })}>
        Ajouter un plat
      </Button>
      <p className="mt-3 text-center text-[13px] text-ink-soft">Un plat désactivé reste en mémoire et disparaît des prochains menus.</p>

      <Sheet open={dialog?.kind === 'new'} onClose={close} title="Nouveau plat" subtitle="Il rejoint ta carte, prêt à être proposé.">
        {dialog?.kind === 'new' && (
          <DishForm
            initial={{ nom: '', categorie: category, actif: true }}
            submitLabel="Ajouter à la carte"
            onCancel={close}
            onSubmit={async (values) => {
              const created = await adminApi.createDish(values);
              catalog.setData((current) => [...(current ?? []), created]);
              setCategory(created.categorie);
              toast.show(`« ${created.nom} » ajouté à la carte`);
              close();
            }}
          />
        )}
      </Sheet>

      <Sheet open={dialog?.kind === 'edit'} onClose={close} title="Modifier le plat" subtitle="Change son nom ou sa catégorie.">
        {dialog?.kind === 'edit' && (
          <DishForm
            initial={dialog.item}
            submitLabel="Enregistrer"
            onCancel={close}
            onDelete={() => setDialog({ kind: 'confirm-delete', item: dialog.item })}
            onSubmit={async (values) => {
              const changes = {
                ...(values.nom !== dialog.item.nom ? { nom: values.nom } : {}),
                ...(values.categorie !== dialog.item.categorie ? { categorie: values.categorie } : {}),
                ...(values.actif !== dialog.item.actif ? { actif: values.actif } : {}),
              };
              if (Object.keys(changes).length > 0) {
                const result = await adminApi.updateDish(dialog.item.id, changes);
                catalog.setData((current) => current?.map((i) => (i.id === result.item.id ? result.item : i)) ?? null);
                toast.show('Plat enregistré');
              }
              close();
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={dialog?.kind === 'confirm-delete'}
        onClose={close}
        title="Supprimer ce plat ?"
        subtitle={dialog?.kind === 'confirm-delete' ? `« ${dialog.item.nom} » sera retiré définitivement de la carte.` : undefined}
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          Les avis et l'historique des clients qui l'ont déjà mangé sont conservés.
        </p>
        <SheetActions>
          <Button icon="trash" onClick={() => dialog?.kind === 'confirm-delete' && void remove(dialog.item)}>
            Oui, supprimer
          </Button>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
        </SheetActions>
      </Sheet>

      <Sheet
        open={dialog?.kind === 'blocked'}
        onClose={close}
        title="Suppression impossible"
        badge={
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-field text-accent-strong">
            <Icon name="lock" />
          </span>
        }
        subtitle={
          dialog?.kind === 'blocked'
            ? `« ${dialog.item.nom} » est proposé sur le menu du ${formatLongDate(dialog.date)}, qui n'est pas encore verrouillé.`
            : undefined
        }
      >
        <p className="text-[15px] leading-relaxed text-ink">Désactive-le plutôt : il disparaîtra des prochains menus, sans être perdu.</p>
        <SheetActions>
          <Button
            onClick={() => {
              if (dialog?.kind === 'blocked') void toggle(dialog.item, false);
              close();
            }}
          >
            Désactiver le plat
          </Button>
          <Button variant="outline" onClick={close}>
            Fermer
          </Button>
        </SheetActions>
      </Sheet>

      <Sheet
        open={dialog?.kind === 'deleted'}
        onClose={close}
        title="Plat supprimé"
        badge={
          <span className="a-pop flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent">
            <Icon name="check" strokeWidth={2.4} />
          </span>
        }
        subtitle={dialog?.kind === 'deleted' ? `« ${dialog.name} » n'est plus sur ta carte.` : undefined}
      >
        {dialog?.kind === 'deleted' && (
          <p className="text-[15px] text-ink">Ta carte compte désormais {plural(dialog.remaining, 'plat')}.</p>
        )}
        <SheetActions>
          <Button onClick={close}>Retour à la carte</Button>
        </SheetActions>
      </Sheet>
    </AdminPage>
  );
}
