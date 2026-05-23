/**
 * Maps Google Places API (New) `regularOpeningHours` onto the EatMe
 * `restaurants.open_hours` jsonb shape.
 *
 * Target shape (matches what the feed Edge Function's isOpenNow() and the
 * mobile map expect — lowercase day keys, 24h "HH:MM" times, one span/day):
 *
 *   { "monday": { "open": "08:00", "close": "23:00" }, ... }
 *
 * NOTE: a one-time copy of this logic lives in
 * `infra/scripts/backfill-open-hours.ts` (a standalone ts-node script that
 * cannot import from the admin app). Keep the two in sync.
 */

/** Google Places API (New) regularOpeningHours payload (only the fields we use). */
export interface GoogleRegularOpeningHours {
  periods?: Array<{
    open?: { day?: number; hour?: number; minute?: number };
    close?: { day?: number; hour?: number; minute?: number };
  }>;
}

/** EatMe open_hours value: one open/close span per day. */
export type OpenHours = Record<string, { open: string; close: string }>;

// Google's `day` is 0 = Sunday ... 6 = Saturday.
const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function fmtTime(hour = 0, minute = 0): string {
  // hour % 24 collapses a stray "24:00" (midnight) to "00:00".
  return `${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Convert a Google `regularOpeningHours` object to `open_hours`.
 * Returns `{}` when there is no usable hours data.
 *
 * A period with an `open` but no `close` is a 24-hour day → stored as
 * `00:00`–`23:59`. When a day has multiple periods (split hours, e.g. lunch +
 * dinner) the result widens to the earliest open and latest close — the
 * open_hours shape stores a single span per day, so this is a deliberate
 * approximation that errs toward "open".
 */
export function mapGoogleOpeningHours(
  regularOpeningHours: GoogleRegularOpeningHours | null | undefined
): OpenHours {
  const periods = regularOpeningHours?.periods;
  if (!periods || periods.length === 0) return {};

  const result: OpenHours = {};
  for (const period of periods) {
    const openPoint = period?.open;
    if (!openPoint || openPoint.day == null) continue;
    const dayName = DAY_NAMES[openPoint.day];
    if (!dayName) continue;

    // open with no close = open 24h that day
    if (!period.close) {
      result[dayName] = { open: '00:00', close: '23:59' };
      continue;
    }

    const open = fmtTime(openPoint.hour, openPoint.minute);
    const close = fmtTime(period.close.hour, period.close.minute);
    const existing = result[dayName];
    if (!existing) {
      result[dayName] = { open, close };
    } else {
      // Multiple periods for the same day → widen to the broadest span.
      if (open < existing.open) existing.open = open;
      if (close > existing.close) existing.close = close;
    }
  }
  return result;
}
