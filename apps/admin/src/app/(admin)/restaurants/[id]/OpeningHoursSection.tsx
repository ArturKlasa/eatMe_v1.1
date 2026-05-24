'use client';

import { useMemo, useState, useTransition } from 'react';
import type { OpenHours } from '@/lib/google/openingHours';
import { updateAdminRestaurantOpeningHours } from './actions/restaurant';

// Day key order matches what the importer writes (lowercase, English) — see
// apps/admin/src/lib/google/openingHours.ts.
const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
type DayKey = (typeof DAY_ORDER)[number];

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

interface Props {
  restaurantId: string;
  openHours: unknown;
}

// Editor row model. `closed` is the canonical "this day has no span" signal so
// the user can keep the previous open/close text while toggling closed on/off
// without losing what they typed.
type DraftRow = { closed: boolean; open: string; close: string };
type Draft = Record<DayKey, DraftRow>;

function toDraft(hours: OpenHours | null): Draft {
  const out = {} as Draft;
  for (const day of DAY_ORDER) {
    const span = hours?.[day];
    out[day] = span
      ? { closed: false, open: span.open, close: span.close }
      : { closed: true, open: '', close: '' };
  }
  return out;
}

function draftToOpenHours(draft: Draft): OpenHours {
  const out: OpenHours = {};
  for (const day of DAY_ORDER) {
    const row = draft[day];
    if (!row.closed && row.open && row.close) {
      out[day] = { open: row.open, close: row.close };
    }
  }
  return out;
}

function isDraftDirty(draft: Draft, initial: Draft): boolean {
  for (const day of DAY_ORDER) {
    const a = draft[day];
    const b = initial[day];
    if (a.closed !== b.closed) return true;
    if (!a.closed && (a.open !== b.open || a.close !== b.close)) return true;
  }
  return false;
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function validateDraft(draft: Draft): string | null {
  for (const day of DAY_ORDER) {
    const row = draft[day];
    if (row.closed) continue;
    if (!HHMM_RE.test(row.open) || !HHMM_RE.test(row.close)) {
      return `${DAY_LABELS[day]}: enter both open and close times in HH:MM`;
    }
  }
  return null;
}

export function OpeningHoursSection({ restaurantId, openHours }: Props) {
  const initialHours = (openHours ?? null) as OpenHours | null;
  const initialDraft = useMemo(() => toDraft(initialHours), [initialHours]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = isDraftDirty(draft, initialDraft);
  const hasAnyHours = DAY_ORDER.some(d => {
    const s = initialHours?.[d];
    return !!(s?.open && s?.close);
  });

  function startEdit() {
    setDraft(initialDraft);
    setError(null);
    setEditing(true);
  }
  function cancelEdit() {
    setDraft(initialDraft);
    setError(null);
    setEditing(false);
  }
  function patchRow(day: DayKey, patch: Partial<DraftRow>) {
    setDraft(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  function handleSave() {
    const v = validateDraft(draft);
    if (v) {
      setError(v);
      return;
    }
    setError(null);

    const next = draftToOpenHours(draft);
    const payload = Object.keys(next).length > 0 ? next : null;

    startTransition(async () => {
      const result = await updateAdminRestaurantOpeningHours(restaurantId, {
        open_hours: payload,
      });
      if (!result.ok) {
        setError(result.formError ?? 'Update failed');
        return;
      }
      // Server revalidates the page, but we also exit edit mode locally so the
      // refreshed read-only view shows immediately when React Server resyncs.
      setEditing(false);
    });
  }

  return (
    <section className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Opening hours</h2>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        hasAnyHours ? (
          DAY_ORDER.map(day => {
            const span = initialHours?.[day];
            return (
              <div key={day} className="flex gap-2 text-sm">
                <span className="w-32 shrink-0 text-muted-foreground">{DAY_LABELS[day]}</span>
                <span className="text-foreground">
                  {span?.open && span?.close ? (
                    `${span.open} – ${span.close}`
                  ) : (
                    <span className="text-muted-foreground">Closed</span>
                  )}
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            No opening hours on record. Older imports may have been saved before the Google Places
            hours mapping landed — click Edit to set them.
          </p>
        )
      ) : (
        <div className="space-y-2">
          {DAY_ORDER.map(day => {
            const row = draft[day];
            return (
              <div key={day} className="flex items-center gap-2 text-sm">
                <span className="w-32 shrink-0 text-muted-foreground">{DAY_LABELS[day]}</span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={row.closed}
                    onChange={e => patchRow(day, { closed: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />
                  Closed
                </label>
                <input
                  type="time"
                  value={row.open}
                  onChange={e => patchRow(day, { open: e.target.value })}
                  disabled={row.closed}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="time"
                  value={row.close}
                  onChange={e => patchRow(day, { close: e.target.value })}
                  disabled={row.closed}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            );
          })}

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !dirty}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <p className="text-xs text-muted-foreground self-center ml-auto">
              Overnight spans (e.g. 18:00 – 02:00) are allowed.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
