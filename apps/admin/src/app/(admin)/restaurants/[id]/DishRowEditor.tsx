'use client';

import { useState, useTransition } from 'react';
import { PRIMARY_PROTEINS } from '@eatme/shared';
import type { AdminMenu, AdminMenuDish, DishCategoryOption } from '@/lib/auth/dal';
import { DishCategoryCombobox } from '@/components/DishCategoryCombobox';
import { DishCategoryCreateInline } from '@/components/DishCategoryCreateInline';
import { adminDeleteDish, adminUpdateDish } from './actions/dish';

const DISH_KINDS = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;
const DISH_STATUSES = ['draft', 'published', 'archived'] as const;

interface Props {
  dish: AdminMenuDish;
  restaurantId: string;
  menus: AdminMenu[];
  dishCategoryOptions: DishCategoryOption[];
  onUpdated: (next: AdminMenuDish) => void;
  // Bubbles up so MenusSection can append the new category to its lifted
  // state — every sibling row's combobox sees it without a page reload.
  onDishCategoryCreated: (cat: DishCategoryOption) => void;
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

// Read-only sub-list of variants (for parents) and courses+items (for
// course_menu parents). Editing happens through the menu-scan review flow;
// this exists to make the saved structure visible on the verifier page.
function DishRowSubList({ dish }: { dish: AdminMenuDish }) {
  const hasVariants = dish.is_parent && dish.variants.length > 0;
  const hasCourses = dish.dish_kind === 'course_menu' && dish.courses.length > 0;
  if (!hasVariants && !hasCourses) return null;

  return (
    <div className="ml-4 mt-1 space-y-1.5">
      {hasVariants && (
        <ul className="space-y-0.5 border-l border-blue-300/50 pl-3 dark:border-blue-900/40">
          {dish.variants.map(v => (
            <li key={v.id} className="flex items-baseline gap-2 text-xs text-muted-foreground">
              <span className="text-blue-600/70 dark:text-blue-300/70">↳</span>
              <span className="flex-1">{v.name}</span>
              <span className="tabular-nums w-16 text-right">{formatPrice(v.price)}</span>
            </li>
          ))}
        </ul>
      )}

      {hasCourses && (
        <ul className="space-y-1 border-l border-purple-300/50 pl-3 dark:border-purple-900/40">
          {dish.courses.map(c => (
            <li key={c.id}>
              <div className="flex items-baseline gap-2 text-xs">
                <span className="font-medium text-purple-900 dark:text-purple-200">
                  {c.course_number}. {c.course_name?.trim() || '(unnamed)'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {c.choice_type === 'one_of' ? `pick ${c.required_count}` : 'fixed'}
                </span>
              </div>
              {c.items.length > 0 && (
                <ul className="ml-3 mt-0.5 space-y-0.5">
                  {c.items.map(it => (
                    <li
                      key={it.id}
                      className="flex items-baseline gap-2 text-[11px] text-muted-foreground"
                    >
                      <span className="flex-1">• {it.option_label}</span>
                      {it.price_delta !== 0 && (
                        <span className="tabular-nums">+{formatPrice(it.price_delta)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DishRowEditor({
  dish,
  restaurantId,
  menus,
  dishCategoryOptions,
  onUpdated,
  onDishCategoryCreated,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Local draft of the dish — initialized from props each time we open edit
  // mode so canceling discards all changes.
  const [draft, setDraft] = useState<AdminMenuDish>(dish);

  function handleDelete() {
    setServerError('');
    startTransition(async () => {
      const result = await adminDeleteDish(dish.id, restaurantId, { hard: false });
      if (!result.ok) {
        setServerError(result.formError ?? 'Archive failed');
        return;
      }
      // Soft delete: dish stays in the local view with archived status so the
      // admin sees what they did and can un-archive by editing it back.
      onUpdated({ ...dish, status: 'archived', is_available: false });
      setShowDeleteConfirm(false);
      setIsEditing(false);
    });
  }

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
          {dish.is_parent && dish.dish_kind !== 'course_menu' && (
            <span className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              {dish.variants.length} variant{dish.variants.length === 1 ? '' : 's'}
            </span>
          )}
          {dish.dish_kind === 'course_menu' && (
            <span className="inline-block rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-800 dark:bg-purple-950/40 dark:text-purple-200">
              {dish.courses.length} course{dish.courses.length === 1 ? '' : 's'}
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
        <DishRowSubList dish={dish} />
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

      <div className="text-xs space-y-1">
        <span className="block text-muted-foreground mb-0.5">Global category</span>
        <div className="flex items-start gap-2">
          <DishCategoryCombobox
            value={draft.dish_category_id ?? null}
            options={dishCategoryOptions}
            className="flex-1"
            onChange={id => setDraft({ ...draft, dish_category_id: id })}
          />
          <DishCategoryCreateInline
            onCreated={cat => {
              onDishCategoryCreated(cat);
              setDraft(d => ({ ...d, dish_category_id: cat.id }));
            }}
          />
        </div>
      </div>

      <label className="text-xs block">
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

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={draft.is_available !== false}
          onChange={e => setDraft({ ...draft, is_available: e.target.checked })}
        />
        <span>Available</span>
      </label>

      {serverError && <p className="text-destructive text-xs">{serverError}</p>}

      {showDeleteConfirm ? (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2 space-y-2">
          <p className="text-xs">
            Archive this dish? It will be hidden from consumers but the row stays in the database.
            You can restore it by editing the status back to <strong>draft</strong> or{' '}
            <strong>published</strong>.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isPending ? 'Archiving…' : 'Confirm archive'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              Keep
            </button>
          </div>
        </div>
      ) : (
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
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isPending}
            className="ml-auto rounded-md border border-destructive px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Archive
          </button>
        </div>
      )}

      <DishRowSubList dish={dish} />
    </li>
  );
}
