'use client';

import { useState, useTransition } from 'react';
import { PRIMARY_PROTEINS, DISH_KIND_META } from '@eatme/shared';
import type { AdminMenuDish, DishCategoryOption } from '@/lib/auth/dal';
import { DishCategoryCombobox } from '@/components/DishCategoryCombobox';
import { DishCategoryCreateInline } from '@/components/DishCategoryCreateInline';
import { adminCreateDish } from './actions/dish';

type DishKind = keyof typeof DISH_KIND_META;
type Protein = (typeof PRIMARY_PROTEINS)[number];
const DISH_KIND_VALUES = Object.keys(DISH_KIND_META) as DishKind[];

interface Props {
  restaurantId: string;
  // null → uncategorized (orphan); the dish lands in the warning box at top.
  menuCategoryId: string | null;
  // Used for the button + form heading copy. Falls back to "Uncategorized"
  // when there's no parent category.
  categoryLabel: string;
  dishCategoryOptions: DishCategoryOption[];
  onCreated: (dish: AdminMenuDish) => void;
  // Bubbles up so MenusSection can append the new category to its lifted
  // state — every sibling row's combobox sees it without a page reload.
  onDishCategoryCreated: (cat: DishCategoryOption) => void;
}

function friendlyError(code: string): string {
  if (code === 'INVALID_DISH_CATEGORY_ID') return 'Selected dish category is invalid.';
  if (code === 'INVALID_MENU_CATEGORY_ID') {
    return 'Menu category no longer exists. Refresh the page.';
  }
  if (code === 'RESTAURANT_NOT_FOUND') return 'Restaurant no longer exists. Refresh the page.';
  return code;
}

export function AddDishButton({
  restaurantId,
  menuCategoryId,
  categoryLabel,
  dishCategoryOptions,
  onCreated,
  onDishCategoryCreated,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  // Empty string forces admin to deliberately pick — primary_protein is NOT NULL
  // on dishes (CLAUDE.md pitfall #6) and a silent default like 'chicken' would
  // mis-classify vegetarian dishes that admin adds in a hurry.
  const [primaryProtein, setPrimaryProtein] = useState<Protein | ''>('');
  const [dishKind, setDishKind] = useState<DishKind>('standard');
  const [dishCategoryId, setDishCategoryId] = useState<string>('');

  function reset() {
    setName('');
    setDescription('');
    setPrice('');
    setPrimaryProtein('');
    setDishKind('standard');
    setDishCategoryId('');
    setServerError('');
  }

  function handleCancel() {
    reset();
    setIsOpen(false);
  }

  function handleSave() {
    setServerError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setServerError('Dish name is required.');
      return;
    }
    if (!primaryProtein) {
      setServerError('Primary protein is required.');
      return;
    }

    const parsedPrice = price.trim() === '' ? null : Number(price);
    if (parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      setServerError('Price must be a non-negative number.');
      return;
    }

    const trimmedDescription = description.trim() === '' ? null : description.trim();
    const resolvedDishCategoryId = dishCategoryId === '' ? null : dishCategoryId;

    startTransition(async () => {
      const result = await adminCreateDish(restaurantId, {
        menu_category_id: menuCategoryId,
        name: trimmedName,
        description: trimmedDescription,
        price: parsedPrice,
        primary_protein: primaryProtein,
        dish_kind: dishKind,
        dish_category_id: resolvedDishCategoryId,
      });
      if (!result.ok) {
        setServerError(friendlyError(result.formError ?? 'Create failed'));
        return;
      }

      // Optimistic insert — construct an AdminMenuDish that matches the row
      // the server just wrote, so the parent's local state can place it
      // without re-fetching the page. dish_category_name is denormalised in
      // the DAL fetch, so we look it up from the options array.
      const dishCategoryName = resolvedDishCategoryId
        ? (dishCategoryOptions.find(c => c.id === resolvedDishCategoryId)?.name ?? null)
        : null;
      const newDish: AdminMenuDish = {
        id: result.data.dishId,
        name: trimmedName,
        description: trimmedDescription,
        price: parsedPrice,
        status: 'draft',
        is_available: true,
        is_template: false,
        dish_kind: dishKind,
        primary_protein: primaryProtein,
        menu_category_id: menuCategoryId,
        dish_category_id: resolvedDishCategoryId,
        dish_category_name: dishCategoryName,
        source_image_index: null,
        serves: null,
        is_parent: false,
        parent_dish_id: null,
        display_price_prefix: 'exact',
        variants: [],
        courses: [],
      };
      onCreated(newDish);
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
        + Add dish to {categoryLabel}
      </button>
    );
  }

  return (
    <div className="rounded-md border border-primary/40 bg-muted/20 p-2 space-y-2 text-sm">
      <div className="text-xs text-muted-foreground">Add dish to {categoryLabel}</div>

      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Dish name"
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

      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Price</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="—"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </label>

        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Kind</span>
          <select
            value={dishKind}
            onChange={e => setDishKind(e.target.value as DishKind)}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {DISH_KIND_VALUES.map(k => (
              <option key={k} value={k}>
                {DISH_KIND_META[k].label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Protein *</span>
          <select
            value={primaryProtein}
            onChange={e => setPrimaryProtein(e.target.value as Protein)}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="" disabled>
              — pick —
            </option>
            {PRIMARY_PROTEINS.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-xs space-y-1">
        <span className="block text-muted-foreground mb-0.5">
          Dish category{' '}
          <span className="text-muted-foreground/60">(filter taxonomy, optional)</span>
        </span>
        <div className="flex items-start gap-2">
          <DishCategoryCombobox
            value={dishCategoryId === '' ? null : dishCategoryId}
            options={dishCategoryOptions}
            className="flex-1"
            onChange={id => setDishCategoryId(id ?? '')}
          />
          <DishCategoryCreateInline
            onCreated={cat => {
              onDishCategoryCreated(cat);
              setDishCategoryId(cat.id);
            }}
          />
        </div>
      </div>

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
