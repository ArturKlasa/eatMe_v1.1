'use client';

import { useState, useTransition } from 'react';
import { suspendRestaurant } from './actions/restaurant';

interface Props {
  restaurantId: string;
  isActive: boolean;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
}

export function AdminSuspensionSection({
  restaurantId,
  isActive,
  suspendedAt,
  suspendedBy,
  suspensionReason,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [serverError, setServerError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  function handleSuspend() {
    if (!reason.trim()) {
      setReasonError('Suspension reason is required');
      return;
    }
    setReasonError('');
    setServerError('');
    startTransition(async () => {
      const result = await suspendRestaurant(restaurantId, {
        is_active: false,
        reason: reason.trim(),
      });
      if (!result.ok) {
        setServerError(result.formError ?? 'Update failed');
      } else {
        setShowConfirm(false);
        setReason('');
      }
    });
  }

  function handleUnsuspend() {
    setServerError('');
    startTransition(async () => {
      const result = await suspendRestaurant(restaurantId, { is_active: true });
      if (!result.ok) {
        setServerError(result.formError ?? 'Update failed');
      }
    });
  }

  return (
    <section className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Suspension</h2>
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
            isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-destructive'
          }`}
        >
          {isActive ? 'Active' : 'Suspended'}
        </span>
      </div>

      {!isActive && (
        <div className="text-sm text-muted-foreground space-y-0.5">
          {suspendedAt && (
            <p>
              Suspended:{' '}
              <span className="text-foreground" suppressHydrationWarning>
                {new Date(suspendedAt).toLocaleString()}
              </span>
            </p>
          )}
          {suspendedBy && (
            <p>
              By admin: <span className="text-foreground font-mono text-xs">{suspendedBy}</span>
            </p>
          )}
          {suspensionReason && (
            <p>
              Reason: <span className="text-foreground">{suspensionReason}</span>
            </p>
          )}
        </div>
      )}

      {serverError && <p className="text-destructive text-sm">{serverError}</p>}

      {isActive ? (
        showConfirm ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="suspension-reason">
              Suspension reason <span className="text-destructive">*</span>
            </label>
            <textarea
              id="suspension-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. spam listings, policy violation…"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {reasonError && <p className="text-destructive text-xs">{reasonError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSuspend}
                disabled={isPending}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isPending ? 'Suspending…' : 'Confirm suspend'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setReason('');
                  setReasonError('');
                }}
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
            className="rounded-md border border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Suspend restaurant
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={handleUnsuspend}
          disabled={isPending}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          {isPending ? 'Unsuspending…' : 'Unsuspend restaurant'}
        </button>
      )}
    </section>
  );
}
