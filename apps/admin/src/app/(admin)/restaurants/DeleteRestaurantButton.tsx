'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminDeleteRestaurant, type AdminDeleteRestaurantCounts } from './[id]/actions/restaurant';

interface Props {
  restaurantId: string;
  restaurantName: string;
}

function formatErrorLabel(code: string): string {
  if (code === 'NOT_FOUND') return 'Restaurant not found.';
  if (code === 'CONFIRM_MISMATCH') return 'Name does not match. Please retype it exactly.';
  if (code === 'FORBIDDEN') return 'Forbidden.';
  if (code === 'UNAUTHENTICATED') return 'Session expired — sign in again.';
  return code;
}

export function DeleteRestaurantButton({ restaurantId, restaurantName }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState<AdminDeleteRestaurantCounts | null>(null);

  const matches = confirmText === restaurantName;

  function close() {
    if (isPending) return;
    setIsOpen(false);
    setConfirmText('');
    setServerError('');
    setResult(null);
  }

  function open() {
    setIsOpen(true);
  }

  function submit() {
    if (!matches || isPending) return;
    setServerError('');
    startTransition(async () => {
      const res = await adminDeleteRestaurant(restaurantId, { confirmName: confirmText });
      if (!res.ok) {
        setServerError(formatErrorLabel(res.formError ?? 'DELETE_FAILED'));
        return;
      }
      setResult(res.data);
      // Refresh the table after a brief moment so the admin sees the counts.
      setTimeout(() => {
        setIsOpen(false);
        setConfirmText('');
        setResult(null);
        router.refresh();
      }, 1500);
    });
  }

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && matches && !isPending && !result) submit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, matches, isPending, result]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-md border border-destructive px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
        aria-label={`Delete ${restaurantName}`}
      >
        Delete
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-restaurant-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {result ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Restaurant deleted</h2>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  <li>
                    {result.menus_deleted} menus, {result.menu_categories_deleted} categories,{' '}
                    {result.dishes_deleted} dishes
                  </li>
                  <li>
                    {result.opinions_deleted} opinions, {result.photos_deleted} photos
                  </li>
                  <li>
                    {result.visits_deleted} visits, {result.favorites_deleted} favorites
                  </li>
                  <li>
                    {result.scan_jobs_deleted} scan jobs ({result.storage_paths?.length ?? 0}{' '}
                    storage files queued for cleanup)
                  </li>
                </ul>
              </div>
            ) : (
              <>
                <h2 id="delete-restaurant-title" className="text-lg font-semibold text-destructive">
                  Delete restaurant permanently?
                </h2>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    This will hard-delete{' '}
                    <span className="font-medium text-foreground">{restaurantName}</span> and
                    destroy:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>All menus, categories, and dishes</li>
                    <li>All dish photos and reviews (user-generated content)</li>
                    <li>All user visits and favorites</li>
                    <li>All menu scan history</li>
                  </ul>
                  <p className="text-destructive font-medium">This cannot be undone.</p>
                </div>

                <label className="block text-sm space-y-1">
                  <span>
                    Type <span className="font-mono font-semibold">{restaurantName}</span> to
                    confirm:
                  </span>
                  <input
                    type="text"
                    autoFocus
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono"
                    aria-label="Type the restaurant name to confirm"
                  />
                </label>

                {serverError && <p className="text-destructive text-xs">{serverError}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={isPending}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!matches || isPending}
                    className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isPending ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
