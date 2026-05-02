'use client';

import { useState, useTransition } from 'react';
import type { AdminMenuCategory, CanonicalCategoryOption } from '@/lib/auth/dal';
import { adminCreateMenuCategory } from './actions/menuCategory';

interface Props {
  restaurantId: string;
  menuId: string;
  // Used in button + form copy ("Add category to Lunch Menu")
  menuName: string;
  // ISO-639-1 code derived from the restaurant's country (en/es/pl/...).
  // Used as the key when mirroring name/description into name_translations
  // so mobile reads the right localised value.
  sourceLanguageCode: string;
  // Already filtered by the parent to exclude canonicals already linked under
  // this menu — the same canonical can legitimately appear in different menus
  // (e.g. "Drinks" in both Lunch and Dinner), but not twice in the same one.
  availableCanonicalOptions: CanonicalCategoryOption[];
  onCreated: (category: AdminMenuCategory) => void;
}

function pickName(dict: Record<string, string>, lang: string, fallback: string): string {
  return dict[lang] ?? dict.en ?? fallback;
}

function friendlyError(code: string): string {
  if (code === 'CATEGORY_NAME_COLLISION') {
    return 'A category with this name already exists in this menu.';
  }
  if (code === 'CATEGORY_ALREADY_LINKED') {
    return 'This canonical category is already linked under this menu.';
  }
  if (code === 'INVALID_MENU_ID') return 'Menu no longer exists. Refresh the page.';
  if (code === 'INVALID_CANONICAL_CATEGORY_ID') {
    return 'Selected canonical category is invalid.';
  }
  return code;
}

// Sentinel for the "no canonical link" choice. A real id is always a uuid,
// so this string can't collide with one.
const CUSTOM = 'custom';

export function AddCategoryButton({
  restaurantId,
  menuId,
  menuName,
  sourceLanguageCode,
  availableCanonicalOptions,
  onCreated,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');

  const [canonicalId, setCanonicalId] = useState<string>(CUSTOM);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function reset() {
    setCanonicalId(CUSTOM);
    setName('');
    setDescription('');
    setServerError('');
  }

  function handleCancel() {
    reset();
    setIsOpen(false);
  }

  // Picking a canonical row auto-fills the name field with the canonical's
  // source-language name. Admin is free to override (e.g. type "Starters"
  // after picking "appetizers") — the canonical link still carries the
  // semantic anchor; the displayed name is just admin's preferred wording.
  function handleCanonicalChange(newId: string) {
    setCanonicalId(newId);
    if (newId === CUSTOM) return;
    const canon = availableCanonicalOptions.find(c => c.id === newId);
    if (canon) {
      setName(pickName(canon.names, sourceLanguageCode, canon.slug));
    }
  }

  function handleSave() {
    setServerError('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setServerError('Category name is required.');
      return;
    }

    const trimmedDescription = description.trim() === '' ? null : description.trim();
    const resolvedCanonicalId = canonicalId === CUSTOM ? null : canonicalId;

    startTransition(async () => {
      const result = await adminCreateMenuCategory(restaurantId, {
        menu_id: menuId,
        name: trimmedName,
        description: trimmedDescription,
        canonical_category_id: resolvedCanonicalId,
        source_language_code: sourceLanguageCode,
      });
      if (!result.ok) {
        setServerError(friendlyError(result.formError ?? 'Create failed'));
        return;
      }

      const lang = sourceLanguageCode;
      const newCategory: AdminMenuCategory = {
        id: result.data.categoryId,
        menu_id: menuId,
        name: trimmedName,
        description: trimmedDescription,
        // Server computes display_order = max + 1; we don't replicate that math
        // client-side. null is fine — the parent's append logic doesn't depend
        // on it, and the next page load fetches the real value.
        display_order: null,
        is_active: true,
        canonical_category_id: resolvedCanonicalId,
        source_language_code: lang,
        name_translations: { [lang]: trimmedName },
        description_translations: trimmedDescription ? { [lang]: trimmedDescription } : {},
        dishes: [],
      };
      onCreated(newCategory);
      reset();
      setIsOpen(false);
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
      >
        + Add category to {menuName}
      </button>
    );
  }

  return (
    <div className="rounded-md border border-primary/40 bg-muted/20 p-2 space-y-2 text-sm">
      <div className="text-xs text-muted-foreground">Add category to {menuName}</div>

      <label className="text-xs block">
        <span className="block text-muted-foreground mb-0.5">
          Pick from canonical taxonomy (optional)
        </span>
        <select
          value={canonicalId}
          onChange={e => handleCanonicalChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value={CUSTOM}>— Custom name —</option>
          {availableCanonicalOptions.map(c => (
            <option key={c.id} value={c.id}>
              {pickName(c.names, sourceLanguageCode, c.slug)}
            </option>
          ))}
        </select>
      </label>

      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={
          canonicalId === CUSTOM
            ? `Category name (in ${sourceLanguageCode})`
            : 'Override displayed name (or keep the canonical default)'
        }
        autoFocus
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
      />

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm resize-none"
      />

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
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
