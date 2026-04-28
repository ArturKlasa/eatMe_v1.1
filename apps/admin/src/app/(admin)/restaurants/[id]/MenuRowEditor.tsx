'use client';

import { useState, useTransition } from 'react';
import type { AdminMenu } from '@/lib/auth/dal';
import { adminDeleteMenu, adminUpdateMenu } from './actions/menu';

const MENU_TYPES = ['food', 'drink'] as const;
const MENU_STATUSES = ['draft', 'published', 'archived'] as const;

interface Props {
  menu: AdminMenu;
  restaurantId: string;
  dishCount: number;
  onUpdated: (next: AdminMenu) => void;
}

function statusBadgeClass(status: string) {
  if (status === 'published') return 'bg-green-100 text-green-800';
  if (status === 'draft') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

export function MenuRowEditor({ menu, restaurantId, dishCount, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [draftName, setDraftName] = useState(menu.name);
  const [draftDescription, setDraftDescription] = useState<string>(menu.description ?? '');
  const [draftMenuType, setDraftMenuType] = useState(menu.menu_type);
  const [draftStatus, setDraftStatus] = useState(menu.status);
  const [draftIsActive, setDraftIsActive] = useState(menu.is_active);

  function handleDelete() {
    setServerError('');
    startTransition(async () => {
      const result = await adminDeleteMenu(menu.id, restaurantId, { hard: false });
      if (!result.ok) {
        setServerError(result.formError ?? 'Archive failed');
        return;
      }
      // Soft delete sets status='archived'. Children (categories + dishes)
      // are NOT cascaded; admin handles them separately if needed.
      onUpdated({ ...menu, status: 'archived' });
      setShowDeleteConfirm(false);
      setIsEditing(false);
    });
  }

  function openEdit() {
    setDraftName(menu.name);
    setDraftDescription(menu.description ?? '');
    setDraftMenuType(menu.menu_type);
    setDraftStatus(menu.status);
    setDraftIsActive(menu.is_active);
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
    if (draftName !== menu.name) patch.name = draftName;
    const normalizedDesc = draftDescription.trim() === '' ? null : draftDescription;
    if (normalizedDesc !== menu.description) patch.description = normalizedDesc;
    if (draftMenuType !== menu.menu_type) patch.menu_type = draftMenuType;
    if (draftStatus !== menu.status) patch.status = draftStatus;
    if (draftIsActive !== menu.is_active) patch.is_active = draftIsActive;

    if (Object.keys(patch).length === 0) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await adminUpdateMenu(menu.id, restaurantId, patch);
      if (!result.ok) {
        setServerError(result.formError ?? 'Update failed');
        return;
      }
      onUpdated({
        ...menu,
        name: draftName,
        description: normalizedDesc,
        menu_type: draftMenuType,
        status: draftStatus,
        is_active: draftIsActive,
      });
      setIsEditing(false);
    });
  }

  if (!isEditing) {
    return (
      <div>
        <button
          type="button"
          onClick={openEdit}
          className="flex w-full items-center gap-2 flex-wrap text-left hover:bg-muted/30 rounded -mx-1 px-1"
        >
          <h3 className="font-semibold text-sm">{menu.name}</h3>
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(menu.status)}`}
          >
            {menu.status}
          </span>
          <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {menu.menu_type}
          </span>
          {!menu.is_active && (
            <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              Inactive
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {menu.categories.length} categor{menu.categories.length === 1 ? 'y' : 'ies'} ·{' '}
            {dishCount} dish{dishCount === 1 ? '' : 'es'}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground/60">click to edit</span>
        </button>
        {menu.description && (
          <p className="mt-1 text-xs italic text-muted-foreground">{menu.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-primary/40 bg-muted/20 p-2 space-y-2 text-sm">
      <div className="text-xs text-muted-foreground">Edit menu</div>

      <input
        type="text"
        value={draftName}
        onChange={e => setDraftName(e.target.value)}
        placeholder="Menu name"
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
      />

      <textarea
        value={draftDescription}
        onChange={e => setDraftDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm resize-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Status</span>
          <select
            value={draftStatus}
            onChange={e => setDraftStatus(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {MENU_STATUSES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-muted-foreground mb-0.5">Type</span>
          <select
            value={draftMenuType}
            onChange={e => setDraftMenuType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {MENU_TYPES.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

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
            Archive this menu? It will be marked status=archived. Its {menu.categories.length}{' '}
            categor{menu.categories.length === 1 ? 'y' : 'ies'} and {dishCount} dish
            {dishCount === 1 ? '' : 'es'} inside remain unchanged — manage them separately if
            needed. You can restore by editing the status.
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
