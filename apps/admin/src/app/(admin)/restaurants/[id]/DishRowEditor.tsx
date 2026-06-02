'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  PRIMARY_PROTEINS,
  DINING_FORMATS,
  DINING_FORMAT_META,
  formatPrice,
  getCurrencyInfo,
  isSupportedCurrency,
  type DiningFormat,
  type SupportedCurrency,
} from '@eatme/shared';
import type {
  AdminMenu,
  AdminMenuDish,
  AdminMenuModifierGroup,
  DishCategoryOption,
} from '@/lib/auth/dal';
import { DishCategoryCombobox } from '@/components/DishCategoryCombobox';
import { DishCategoryCreateInline } from '@/components/DishCategoryCreateInline';
import { ModifierGroupsEditor } from '@/components/modifiers/ModifierGroupsEditor';
import {
  addGroup,
  addOption,
  moveGroup,
  moveOption,
  removeGroup,
  removeOption,
  updateGroup,
  updateOption,
} from '@/components/modifiers/groupReducers';
import { groupsEqual, toApiGroups, toEditableGroups } from '@/components/modifiers/adapters';
import type { EditableModifierGroup } from '@/components/modifiers/editableTypes';
import { adminDeleteDish, adminUpdateDish, adminUpdateDishModifiers } from './actions/dish';

const DISH_STATUSES = ['draft', 'published', 'archived'] as const;

interface Props {
  dish: AdminMenuDish;
  restaurantId: string;
  menus: AdminMenu[];
  dishCategoryOptions: DishCategoryOption[];
  // ISO 4217 from the parent restaurant. Drives formatPrice() output + the
  // currency badge next to the price input. Drilled in via prop rather than
  // re-fetched per row.
  currencyCode: string;
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

// formatPriceCell: nullable-price wrapper around @eatme/shared formatPrice.
// Falls back to USD when the parent passes an unsupported currency string —
// shouldn't happen in practice (restaurants.currency_code is CHECK-constrained)
// but keeps the render path total.
function formatPriceCell(price: number | null, currencyCode: string): string {
  if (price == null) return '—';
  const currency: SupportedCurrency | undefined = isSupportedCurrency(currencyCode)
    ? currencyCode
    : undefined;
  return formatPrice(price, currency);
}

// Sub-list shown beneath each dish row. Modifier groups render via
// <ModifierGroupsSummary> (read-only); clicking the row enters edit mode
// where <ModifierGroupsEditor> appears for editing. Variants and courses
// remain read-only here (kept until Phase 7 drops those tables).
function DishRowSubList({ dish, currencyCode }: { dish: AdminMenuDish; currencyCode: string }) {
  const hasModifiers = dish.modifier_groups.length > 0;
  const hasBundled = (dish.bundled_items?.length ?? 0) > 0;
  const hasVariants = dish.is_parent && dish.variants.length > 0;
  const hasCourses = dish.dish_kind === 'course_menu' && dish.courses.length > 0;
  if (!hasModifiers && !hasBundled && !hasVariants && !hasCourses) return null;

  return (
    <div className="ml-4 mt-1 space-y-1.5">
      {hasModifiers && (
        <ModifierGroupsSummary groups={dish.modifier_groups} currencyCode={currencyCode} />
      )}

      {hasBundled && (
        <ul className="space-y-0.5 border-l border-emerald-300/50 pl-3 dark:border-emerald-900/40">
          {(dish.bundled_items ?? []).map((b, i) => (
            <li
              key={`${b.name}-${i}`}
              className="flex items-baseline gap-2 text-xs text-muted-foreground"
            >
              <span className="text-emerald-600/70 dark:text-emerald-300/70">🎁</span>
              <span className="flex-1">{b.name}</span>
              {b.note && (
                <span className="text-[10px] italic text-muted-foreground/80">{b.note}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasVariants && (
        <ul className="space-y-0.5 border-l border-blue-300/50 pl-3 dark:border-blue-900/40">
          {dish.variants.map(v => (
            <li key={v.id} className="flex items-baseline gap-2 text-xs text-muted-foreground">
              <span className="text-blue-600/70 dark:text-blue-300/70">↳</span>
              <span className="flex-1">{v.name}</span>
              <span className="tabular-nums w-20 text-right">
                {formatPriceCell(v.price, currencyCode)}
              </span>
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
                        <span className="tabular-nums">
                          +{formatPriceCell(it.price_delta, currencyCode)}
                        </span>
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
  currencyCode,
  onUpdated,
  onDishCategoryCreated,
}: Props) {
  const currencyInfo = isSupportedCurrency(currencyCode) ? getCurrencyInfo(currencyCode) : null;
  const currencySymbol = currencyInfo?.symbol ?? '$';
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Local draft of the dish — initialized from props each time we open edit
  // mode so canceling discards all changes.
  const [draft, setDraft] = useState<AdminMenuDish>(dish);
  // Modifier groups draft (parallels `draft`). Reset alongside it on openEdit
  // so cancel discards group edits too. Source-of-truth read path is still
  // `dish.modifier_groups`; this is editor-local until Save.
  const [draftGroups, setDraftGroups] = useState<EditableModifierGroup[]>(() =>
    toEditableGroups(dish.modifier_groups)
  );

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
    setDraftGroups(toEditableGroups(dish.modifier_groups));
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
    if (draft.menu_category_id !== dish.menu_category_id)
      patch.menu_category_id = draft.menu_category_id;
    if (draft.dish_category_id !== dish.dish_category_id)
      patch.dish_category_id = draft.dish_category_id;
    if (draft.dining_format !== dish.dining_format) patch.dining_format = draft.dining_format;
    if (draft.portion_amount !== dish.portion_amount || draft.portion_unit !== dish.portion_unit) {
      // Always send as a pair so the DB CHECK constraint never sees half-state.
      patch.portion_amount = draft.portion_amount;
      patch.portion_unit = draft.portion_unit;
    }

    const scalarChanged = Object.keys(patch).length > 0;
    const groupsChanged = !groupsEqual(draftGroups, dish.modifier_groups);

    if (!scalarChanged && !groupsChanged) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      // Step 1 — modifier replace FIRST (the more error-prone operation; a
      // failure here aborts cleanly with no scalar write, so Cancel still
      // discards everything).
      if (groupsChanged) {
        const result = await adminUpdateDishModifiers(dish.id, restaurantId, {
          groups: toApiGroups(draftGroups),
        });
        if (!result.ok) {
          setServerError(result.formError ?? 'Modifier update failed');
          return;
        }
      }

      // Step 2 — scalar update (only when dirty).
      if (scalarChanged) {
        const result = await adminUpdateDish(dish.id, restaurantId, patch);
        if (!result.ok) {
          setServerError(
            groupsChanged
              ? `Modifier groups saved, but dish update failed: ${result.formError ?? 'unknown error'}`
              : (result.formError ?? 'Update failed')
          );
          return;
        }
      }

      // Apply optimistic state for scalar fields only. Modifier groups update
      // via router.refresh() — the server actions call revalidatePath, and
      // refresh propagates that to the client (~100ms). Brief stale read in
      // the <ModifierGroupsSummary> is acceptable; avoids synthesising
      // placeholder UUIDs to satisfy React keys.
      const nextDishCategoryName =
        draft.dish_category_id != null
          ? (dishCategoryOptions.find(o => o.id === draft.dish_category_id)?.name ?? null)
          : null;
      onUpdated({
        ...draft,
        dish_category_name: nextDishCategoryName,
        // Pre-save modifier groups in optimistic state; router.refresh()
        // pulls the freshly-persisted set.
        modifier_groups: dish.modifier_groups,
      });
      if (groupsChanged) {
        router.refresh();
      }
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
          <span className="tabular-nums text-muted-foreground w-20 text-right">
            {formatPriceCell(dish.price, currencyCode)}
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
          {dish.modifier_groups.length > 0 && (
            <span
              className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              title="Modifier groups (size, protein, toppings, etc.)"
            >
              {dish.modifier_groups.length} group
              {dish.modifier_groups.length === 1 ? '' : 's'}
            </span>
          )}
          {dish.dining_format && (
            <span
              className="inline-block rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
              title={DINING_FORMAT_META[dish.dining_format as DiningFormat]?.description}
            >
              {DINING_FORMAT_META[dish.dining_format as DiningFormat]?.icon ?? '🍽️'}{' '}
              {DINING_FORMAT_META[dish.dining_format as DiningFormat]?.label ?? dish.dining_format}
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
        <DishRowSubList dish={dish} currencyCode={currencyCode} />
      </li>
    );
  }

  return (
    <li className="rounded-md border border-primary/40 bg-muted/20 p-3 my-1 space-y-2 text-sm">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-start">
        <input
          type="text"
          value={draft.name}
          onChange={e => setDraft({ ...draft, name: e.target.value })}
          placeholder="Dish name"
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
        {/* Portion (amount + unit) — both null or both set; pair clears together. */}
        <input
          type="number"
          value={draft.portion_amount ?? ''}
          step="1"
          min="1"
          onChange={e => {
            const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
            setDraft({
              ...draft,
              portion_amount: v,
              portion_unit:
                v === null ? null : ((draft.portion_unit ?? 'g') as 'g' | 'ml' | 'pcs' | 'oz'),
            });
          }}
          placeholder="size"
          aria-label="Portion size"
          title="Portion size — extract from menu (e.g. 250g, 0.5L, 6 szt.)"
          className="rounded-md border border-input bg-background px-2 py-1 text-sm w-16"
        />
        <select
          value={draft.portion_unit ?? ''}
          disabled={draft.portion_amount == null}
          onChange={e =>
            setDraft({ ...draft, portion_unit: e.target.value as 'g' | 'ml' | 'pcs' | 'oz' })
          }
          aria-label="Portion unit"
          className="rounded-md border border-input bg-background px-1 py-1 text-sm disabled:opacity-50"
        >
          <option value="" disabled>
            —
          </option>
          <option value="g">g</option>
          <option value="ml">ml</option>
          <option value="pcs">pcs</option>
          <option value="oz">oz</option>
        </select>
        <div
          className="flex items-stretch rounded-md border border-input bg-background overflow-hidden w-28"
          title={`Price in ${currencyCode}`}
        >
          <span className="px-1.5 flex items-center text-xs text-muted-foreground bg-muted/40 border-r border-input">
            {currencySymbol}
          </span>
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
            aria-label={`Price (${currencyCode})`}
            className="flex-1 min-w-0 bg-transparent px-2 py-1 text-sm focus:outline-none"
          />
        </div>
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

        <label
          className="text-xs"
          title="Rarely set — only for buffets, course menus, hot pot, shared plates, samplers"
        >
          <span className="block text-muted-foreground mb-0.5">Dining format</span>
          <select
            value={draft.dining_format ?? ''}
            onChange={e =>
              setDraft({
                ...draft,
                dining_format: e.target.value === '' ? null : (e.target.value as DiningFormat),
              })
            }
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="">— Standard —</option>
            {DINING_FORMATS.map(f => (
              <option key={f} value={f}>
                {DINING_FORMAT_META[f].icon} {DINING_FORMAT_META[f].label}
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

      <div className="border-t border-border pt-2">
        <ModifierGroupsEditor
          groups={draftGroups}
          saving={isPending}
          currencyCode={currencyCode}
          onAddGroup={() => setDraftGroups(g => addGroup(g))}
          onRemoveGroup={i => setDraftGroups(g => removeGroup(g, i))}
          onMoveGroup={(from, to) => setDraftGroups(g => moveGroup(g, from, to))}
          onUpdateGroup={(i, patch) => setDraftGroups(g => updateGroup(g, i, patch))}
          onAddOption={i => setDraftGroups(g => addOption(g, i))}
          onRemoveOption={(gi, oi) => setDraftGroups(g => removeOption(g, gi, oi))}
          onMoveOption={(gi, from, to) => setDraftGroups(g => moveOption(g, gi, from, to))}
          onUpdateOption={(gi, oi, patch) => setDraftGroups(g => updateOption(g, gi, oi, patch))}
        />
      </div>

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

      <DishRowSubList dish={dish} currencyCode={currencyCode} />
    </li>
  );
}

// Collapsible summary of a dish's modifier groups, rendered in the read-only
// row. Editing happens in the expanded edit-mode form via <ModifierGroupsEditor>.
function ModifierGroupsSummary({
  groups,
  currencyCode,
}: {
  groups: AdminMenuModifierGroup[];
  currencyCode: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (groups.length === 0) return null;

  return (
    <div className="rounded border border-dashed border-amber-200 bg-amber-50/30 px-2 py-1.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/15">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 text-amber-900 dark:text-amber-200"
      >
        <span className="font-medium">Modifier groups ({groups.length})</span>
        <span className="text-[10px]">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <ul className="mt-1.5 space-y-1.5">
          {groups.map(g => (
            <li key={g.id} className="space-y-0.5">
              <div className="flex items-baseline gap-2 text-amber-900 dark:text-amber-200">
                <span className="font-medium">{g.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {g.selection_type === 'single' ? 'single' : 'multiple'} · {g.min_selections}–
                  {g.max_selections}
                </span>
                {g.display_in_card && (
                  <span className="text-[10px] rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                    card
                  </span>
                )}
              </div>
              {g.options.length > 0 && (
                <ul className="ml-3 space-y-0.5">
                  {g.options.map(o => (
                    <li
                      key={o.id}
                      className="flex items-baseline gap-1.5 text-[11px] text-muted-foreground"
                    >
                      <span className="flex-1">
                        {o.is_default ? '★ ' : '• '}
                        {o.name}
                      </span>
                      {o.price_override != null ? (
                        <span className="tabular-nums">
                          = {formatPriceCell(o.price_override, currencyCode)}
                        </span>
                      ) : o.price_delta !== 0 ? (
                        <span className="tabular-nums">
                          {o.price_delta > 0 ? '+' : ''}
                          {formatPriceCell(o.price_delta, currencyCode)}
                        </span>
                      ) : null}
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
