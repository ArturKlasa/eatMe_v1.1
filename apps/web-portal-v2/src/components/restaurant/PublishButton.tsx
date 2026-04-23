'use client';

import { useState, useTransition } from 'react';
import { publishRestaurant } from '@/app/(app)/restaurant/[id]/actions/restaurant';

interface Props {
  restaurantId: string;
  status: string;
  isPublishable: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  published: 'Live',
  archived: 'Archived',
  draft: 'Draft',
};

const STATUS_CHIP_CLASS: Record<string, string> = {
  published: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
  draft: 'bg-yellow-100 text-yellow-800',
};

export function PublishButton({ restaurantId, status, isPublishable }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handlePublish = () => {
    setError(null);
    startTransition(async () => {
      const result = await publishRestaurant(restaurantId);
      if (!result.ok) {
        const msg =
          result.formError === 'FORBIDDEN'
            ? 'You do not have permission to publish this restaurant.'
            : result.formError === 'NOT_FOUND'
              ? 'Restaurant not found.'
              : result.formError === 'VALIDATION'
                ? 'Some required fields are missing or invalid.'
                : 'Something went wrong. Please try again.';
        setError(msg);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CHIP_CLASS[status] ?? STATUS_CHIP_CLASS.draft}`}
        data-testid="status-chip"
      >
        {STATUS_LABEL[status] ?? 'Draft'}
      </span>

      {status === 'draft' && (
        <button
          onClick={handlePublish}
          disabled={!isPublishable || isPending}
          data-testid="publish-button"
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !isPublishable
              ? 'Complete address, location, and cuisines before publishing'
              : undefined
          }
        >
          {isPending ? 'Publishing…' : 'Publish'}
        </button>
      )}

      {!isPublishable && status === 'draft' && (
        <p className="text-xs text-muted-foreground">
          Complete address, location, and cuisine selection to publish.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
