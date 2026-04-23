'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  unpublishRestaurant,
  archiveRestaurant,
} from '@/app/(app)/restaurant/[id]/actions/restaurant';

interface Props {
  restaurantId: string;
  status: string;
}

type Confirm = 'unpublish' | 'archive' | null;

export function SettingsActions({ restaurantId, status }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleUnpublish = () => {
    setError(null);
    startTransition(async () => {
      const result = await unpublishRestaurant(restaurantId);
      if (!result.ok) {
        setError('Failed to unpublish. Please try again.');
      } else {
        router.push(`/restaurant/${restaurantId}`);
      }
      setConfirm(null);
    });
  };

  const handleArchive = () => {
    setError(null);
    startTransition(async () => {
      const result = await archiveRestaurant(restaurantId);
      if (!result.ok) {
        setError('Failed to archive. Please try again.');
      } else {
        router.push('/onboard');
      }
      setConfirm(null);
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {status === 'published' && (
        <section className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <h2 className="font-medium">Unpublish</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Remove your restaurant from the consumer feed. Your menus and dishes are preserved and
              you can re-publish at any time.
            </p>
          </div>

          {confirm === 'unpublish' ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleUnpublish}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isPending ? 'Unpublishing…' : 'Confirm unpublish'}
              </button>
              <button
                onClick={() => setConfirm(null)}
                disabled={isPending}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm('unpublish')}
              data-testid="unpublish-button"
              className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted"
            >
              Unpublish
            </button>
          )}
        </section>
      )}

      <section className="rounded-lg border border-destructive/30 p-4 space-y-3">
        <div>
          <h2 className="font-medium text-destructive">Archive restaurant</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently remove this restaurant from your account. This action cannot be undone from
            the owner portal.
          </p>
        </div>

        {confirm === 'archive' ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isPending ? 'Archiving…' : 'Confirm archive'}
            </button>
            <button
              onClick={() => setConfirm(null)}
              disabled={isPending}
              className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm('archive')}
            data-testid="archive-button"
            className="px-4 py-2 text-sm font-medium rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            Archive
          </button>
        )}
      </section>
    </div>
  );
}
