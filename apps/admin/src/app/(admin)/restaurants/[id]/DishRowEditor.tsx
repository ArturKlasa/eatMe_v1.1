'use client';

import { useState, useTransition } from 'react';
import { PRIMARY_PROTEINS } from '@eatme/shared';
import type { AdminMenu, AdminMenuDish, DishCategoryOption } from '@/lib/auth/dal';
import { adminUpdateDish } from './actions/dish';

const DISH_KINDS = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;
const DISH_STATUSES = ['draft', 'published', 'archived'] as const;

interface Props {
  dish: AdminMenuDish;
  restaurantId: string;
  menus: AdminMenu[];
  dishCategoryOptions: DishCategoryOption[];
  onUpdated: (next: AdminMenuDish) => void;
}

function statusBadgeClass(status: string) {
  if (status === 'published') return 'bg-green-100 text-green-800';
  if (status === 'draft') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return price.toFixed(2);
}

export function DishRowEditor({
  dish,
  restaurantId,
  menus,
  dishCategoryOptions,
  onUpdated,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');

  // Local draft of the dish — initialized from props each time we open edit
  // mode so canceling discards all changes.
  const [draft, setDraft] = useState<AdminMenuDish>(dish);

  function openEdit() {
    setDraft(dish);
    setServerError('');
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setServerError('');
  }

  function handleSave() {
    setServerError('');
    // Only send fields that actually changed. Reduces audit-log noise.
    const patch: Record<string, unknown> = {};
    if (draft.name !== dish.name) patch.name = draft.name;
    if (draft.description !== dish.description) patch.description = draft.description;
    if (draft.price !== dish.price) patch.price = draft.price;
    if (draft.status !== dish.status) patch.status = draft.status;
    if (draft.is_available !== dish.is_available) patch.is_available = draft.is_available ?? true;
    if (draft.primary_protein !== dish.primary_protein)
      patch.primary_protein = draft.primary_protein;
    if (draft.dish_kind !== dish.dish_kind) patch.dish_kind = draft.dish_kind;
    if (draft.menu_category_id !== dish.menu_category_id)
      patch.menu_category_id = draft.menu_category_id;
    if (draft.dish_category_id !== dish.dish_category_id)
      patch.dish_category_id = draft.dish_category_id;

    if (Object.keys(patch).length === 0) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await adminUpdateDish(dish.id, restaurantId, patch);
      if (!result.ok) {
        setServerError(result.formError ?? 'Update failed');
        return;
      }
      // Apply the optimistic state to the parent list. The server has already
      // persisted; revalidatePath will refetch on next navigation.
      const nextDishCategoryName =
        draft.dish_category_id != null
          ? (dishCategoryOptions.find(o => o.id === draft.dish_category_id)?.name ?? null)
          : null;
      onUpdated({ ...draft, dish_category_name: nextDishCategoryName });
      setIsEditing(false);
    });
  }

  if (!isEditing) {
    return (
      <li className="py-1">
        <button
          type="button"
          onClick={openEdit}
          className="flex w-full items-baseline gap-2 text-left text-sm hover:bg-muted/30 rounded px-1 -mx-1"
        >
          <span className="flex-1 text-foreground">{dish.name}</span>
          <span className="tabular-nums text-muted-foreground w-16 text-right">
            {formatPrice(dish.price)}
          </span>
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(dish.status)}`}
          >
            {dish.status}
          </span>
          {dish.dish_kind !== 'standard' && (
            <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {dish.dish_kind}
            </span>
          )}
          {dish.is_template && (
            <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              template
            </span>
          )}
          {dish.is_available === false && (
            <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
              unavailable
            </span>
          )}
          <span
            className="w-32 truncate text-xs text-muted-foreground"
            title={dish.dish_category_name ?? ''}
          >
            {dish.dish_category_name ?? '—'}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-primary/40 bg-muted/20 p-3 my-1 space-y-2 text-sm">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="text"
          value={draft.name}
          onChange={e => setDraft({ ...draft, name: e.target.value })}
          placeholder="Dish name"
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
        <input
          type="number"
          value={draft.price ?? ''}
          step="0.01"
          min="0"
          onChange={e =>
            setDraft({
              ...draft,
              price: e.target.value === '' ? null : parseFloat(e.target.value),
            })
          }
          placeholder="0.00"
          className="rounded-md border border-input bg-background px-2 py-1 text-sm w-24"
        />
      </div>

      <textarea
        value={draft.description ?? ''}
        onChange={e => setDraft({ ...draft, description: e.target.value || null })}
        placeholder="Description"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm resize-none"
      />

      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Status</span>
          <select
            value={draft.status}
            onChange={e => setDraft({ ...draft, status: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {DISH_STATUSES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Protein</span>
          <select
            value={draft.primary_protein ?? ''}
            onChange={e => setDraft({ ...draft, primary_protein: e.target.value || null })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {PRIMARY_PROTEINS.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Kind</span>
          <select
            value={draft.dish_kind}
            onChange={e => setDraft({ ...draft, dish_kind: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {DISH_KINDS.map(k => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Global category</span>
          <select
            value={draft.dish_category_id ?? ''}
            onChange={e =>
              setDraft({
                ...draft,
                dish_category_id: e.target.value === '' ? null : e.target.value,
              })
            }
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="">— None —</option>
            {dishCategoryOptions.map(o => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.is_drink ? ' (drink)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Menu section</span>
          <select
            value={draft.menu_category_id ?? ''}
            onChange={e =>
              setDraft({
                ...draft,
                menu_category_id: e.target.value === '' ? null : e.target.value,
              })
            }
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="">— Uncategorized —</option>
            {menus.map(m => (
              <optgroup key={m.id} label={m.name}>
                {m.categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={draft.is_available !== false}
          onChange={e => setDraft({ ...draft, is_available: e.target.checked })}
        />
        <span>Available</span>
      </label>

      {serverError && <p className="text-destructive text-xs">{serverError}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={isPending}
          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </li>
  );
}
