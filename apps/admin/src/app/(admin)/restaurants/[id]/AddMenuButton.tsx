'use client';

import { useState, useTransition } from 'react';
import type { AdminMenu } from '@/lib/auth/dal';
import { adminCreateMenu } from './actions/menu';

const MENU_TYPES = ['food', 'drink'] as const;
type MenuType = (typeof MENU_TYPES)[number];

interface Props {
  restaurantId: string;
  onCreated: (menu: AdminMenu) => void;
}

function friendlyError(code: string): string {
  if (code === 'RESTAURANT_NOT_FOUND') return 'Restaurant no longer exists. Refresh the page.';
  return code;
}

export function AddMenuButton({ restaurantId, onCreated }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [menuType, setMenuType] = useState<MenuType>('food');

  function reset() {
    setName('');
    setDescription('');
    setMenuType('food');
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
      setServerError('Menu name is required.');
      return;
    }

    const trimmedDescription = description.trim() === '' ? null : description.trim();

    startTransition(async () => {
      const result = await adminCreateMenu(restaurantId, {
        name: trimmedName,
        description: trimmedDescription,
        menu_type: menuType,
      });
      if (!result.ok) {
        setServerError(friendlyError(result.formError ?? 'Create failed'));
        return;
      }

      // Optimistic insert. Server lands status='draft' explicitly (mig 117
      // default would otherwise auto-publish), is_active=true, and computes
      // display_order = max + 1. We don't replicate the order math
      // client-side; null is fine and the next page load fetches the real
      // value via getAdminRestaurantMenus.
      const newMenu: AdminMenu = {
        id: result.data.menuId,
        name: trimmedName,
        description: trimmedDescription,
        menu_type: menuType,
        status: 'draft',
        is_active: true,
        display_order: null,
        categories: [],
      };
      onCreated(newMenu);
      reset();
      setIsOpen(false);
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
      >
        + Add menu
      </button>
    );
  }

  return (
    <div className="rounded-md border border-primary/40 bg-muted/20 p-2 space-y-2 text-sm">
      <div className="text-xs text-muted-foreground">Add menu</div>

      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Menu name (e.g. Lunch Menu)"
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

      <label className="text-xs block">
        <span className="block text-muted-foreground mb-0.5">Type</span>
        <select
          value={menuType}
          onChange={e => setMenuType(e.target.value as MenuType)}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {MENU_TYPES.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
