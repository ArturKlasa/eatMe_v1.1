'use client';

import { useState, useTransition } from 'react';
import { adminPublishRestaurant } from './actions/restaurant';

interface Props {
  restaurantId: string;
  status: string;
  draftMenusCount: number;
  draftDishesCount: number;
}

export function PublishSection({ restaurantId, status, draftMenusCount, draftDishesCount }: Props) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastResult, setLastResult] = useState<{
    menusPublished: number;
    dishesPublished: number;
  } | null>(null);

  const isDraft = status === 'draft';
  const hasNothingToPublish = !isDraft && draftMenusCount === 0 && draftDishesCount === 0;

  function handlePublish() {
    setServerError('');
    startTransition(async () => {
      const result = await adminPublishRestaurant(restaurantId);
      if (!result.ok) {
        setServerError(result.formError ?? 'Publish failed');
      } else {
        setShowConfirm(false);
        setLastResult({
          menusPublished: result.data.menusPublished,
          dishesPublished: result.data.dishesPublished,
        });
      }
    });
  }

  return (
    <section className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Publication</h2>
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
            isDraft ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
          }`}
        >
          {status}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {isDraft
          ? 'Restaurant is in draft and not visible in the mobile app.'
          : 'Restaurant is live in the mobile feed.'}
      </p>

      {(isDraft || draftMenusCount > 0 || draftDishesCount > 0) && (
        <div className="text-sm rounded bg-muted/30 border border-border p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pending drafts to publish
          </p>
          <p>
            {isDraft && '1 restaurant · '}
            {draftMenusCount} menu{draftMenusCount === 1 ? '' : 's'} · {draftDishesCount} dish
            {draftDishesCount === 1 ? '' : 'es'}
          </p>
        </div>
      )}

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      {lastResult && (
        <p className="text-sm text-green-700 dark:text-green-400">
          ✓ Published {lastResult.menusPublished} menu
          {lastResult.menusPublished === 1 ? '' : 's'} and {lastResult.dishesPublished} dish
          {lastResult.dishesPublished === 1 ? '' : 'es'}.
        </p>
      )}

      {hasNothingToPublish ? (
        <p className="text-xs text-muted-foreground italic">Nothing to publish.</p>
      ) : showConfirm ? (
        <div className="space-y-2">
          <p className="text-sm">
            This will flip the restaurant
            {isDraft ? ', ' : ' and '}
            {draftMenusCount > 0 &&
              `${draftMenusCount} draft menu${draftMenusCount === 1 ? '' : 's'}`}
            {draftMenusCount > 0 && draftDishesCount > 0 && ', and '}
            {draftDishesCount > 0 &&
              `${draftDishesCount} draft dish${draftDishesCount === 1 ? '' : 'es'}`}{' '}
            to <strong>published</strong>. They will become visible in the mobile feed immediately.
            Continue?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? 'Publishing…' : 'Confirm publish'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {isDraft ? 'Publish restaurant' : 'Publish pending drafts'}
        </button>
      )}
    </section>
  );
}
