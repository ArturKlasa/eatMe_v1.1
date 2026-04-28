'use client';

import { useState, useTransition } from 'react';
import type { AdminMenuCategory } from '@/lib/auth/dal';
import { adminDeleteMenuCategory, adminUpdateMenuCategory } from './actions/menuCategory';

interface Props {
  category: AdminMenuCategory;
  restaurantId: string;
  onUpdated: (next: AdminMenuCategory) => void;
}

function friendlyError(code: string): string {
  if (code === 'CATEGORY_NAME_COLLISION') {
    return 'A category with this name already exists in this menu.';
  }
  if (code === 'NOT_FOUND') return 'Category no longer exists. Refresh the page.';
  return code;
}

export function CategoryRowEditor({ category, restaurantId, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [draftName, setDraftName] = useState(category.name);
  const [draftDescription, setDraftDescription] = useState<string>(category.description ?? '');
  const [draftIsActive, setDraftIsActive] = useState(category.is_active);

  function handleDelete() {
    setServerError('');
    startTransition(async () => {
      const result = await adminDeleteMenuCategory(category.id, restaurantId, { hard: false });
      if (!result.ok) {
        setServerError(friendlyError(result.formError ?? 'Archive failed'));
        return;
      }
      // Soft delete flips is_active=false. Dishes inside keep their
      // menu_category_id so they don't become orphans.
      onUpdated({ ...category, is_active: false });
      setShowDeleteConfirm(false);
      setIsEditing(false);
    });
  }

  function openEdit() {
    setDraftName(category.name);
    setDraftDescription(category.description ?? '');
    setDraftIsActive(category.is_active);
    setServerError('');
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setServerError('');
  }

  function handleSave() {
    setServerError('');
    const patch: Record<string, unknown> = {};
    if (draftName !== category.name) patch.name = draftName;
    const normalizedDesc = draftDescription.trim() === '' ? null : draftDescription;
    if (normalizedDesc !== category.description) patch.description = normalizedDesc;
    if (draftIsActive !== category.is_active) patch.is_active = draftIsActive;

    if (Object.keys(patch).length === 0) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await adminUpdateMenuCategory(category.id, restaurantId, patch);
      if (!result.ok) {
        setServerError(friendlyError(result.formError ?? 'Update failed'));
        return;
      }
      // Optimistic local update — also update name_translations and
      // description_translations entries so the next render's display is
      // consistent with the server's symmetric write.
      const lang = category.source_language_code;
      const nextNameTranslations = lang
        ? { ...category.name_translations, [lang]: draftName }
        : category.name_translations;
      const nextDescTranslations = lang
        ? normalizedDesc == null
          ? Object.fromEntries(
              Object.entries(category.description_translations).filter(([k]) => k !== lang)
            )
          : { ...category.description_translations, [lang]: normalizedDesc }
        : category.description_translations;

      onUpdated({
        ...category,
        name: draftName,
        description: normalizedDesc,
        is_active: draftIsActive,
        name_translations: nextNameTranslations,
        description_translations: nextDescTranslations,
      });
      setIsEditing(false);
    });
  }

  const isCanonical = category.canonical_category_id != null;

  if (!isEditing) {
    return (
      <div>
        <button
          type="button"
          onClick={openEdit}
          className="flex w-full items-center gap-2 flex-wrap text-left hover:bg-muted/30 rounded -mx-1 px-1"
        >
          <h4 className="font-medium text-sm">{category.name}</h4>
          <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {isCanonical ? 'Canonical' : 'Custom'}
          </span>
          {!category.is_active && (
            <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              Inactive
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {category.dishes.length} dish{category.dishes.length === 1 ? '' : 'es'}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground/60">click to edit</span>
        </button>
        {category.description && (
          <p className="mt-1 text-xs italic text-muted-foreground">{category.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-primary/40 bg-muted/20 p-2 space-y-2 text-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
          {isCanonical ? 'Canonical' : 'Custom'}
        </span>
        <span>Edit category</span>
      </div>

      <input
        type="text"
        value={draftName}
        onChange={e => setDraftName(e.target.value)}
        placeholder="Category name"
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
      />

      <textarea
        value={draftDescription}
        onChange={e => setDraftDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm resize-none"
      />

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={draftIsActive}
          onChange={e => setDraftIsActive(e.target.checked)}
        />
        <span>Active (visible to consumers)</span>
      </label>

      {serverError && <p className="text-destructive text-xs">{serverError}</p>}

      {showDeleteConfirm ? (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2 space-y-2">
          <p className="text-xs">
            Archive this category? It will be hidden from consumers (is_active=false). Its{' '}
            {category.dishes.length} dish{category.dishes.length === 1 ? '' : 'es'} will keep their
            category link but inherit the hidden state. You can restore by editing the Active
            checkbox.
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
    </div>
  );
}
