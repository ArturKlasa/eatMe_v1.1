/**
 * Admin timestamp formatting.
 *
 * Every admin-facing timestamp renders in Mexico City time
 * (`America/Mexico_City`, UTC-6 year-round since Mexico dropped DST in 2022 —
 * the IANA zone encodes that) with a fixed `en-US` locale. Pinning both the
 * timezone and the locale makes output identical on the server (Vercel = UTC)
 * and in the browser, regardless of the operator's machine settings — so
 * server components no longer leak UTC and there's no SSR/client mismatch.
 */

export const ADMIN_TIME_ZONE = 'America/Mexico_City';

const PLACEHOLDER = '—';

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date + time, e.g. `Jun 25, 2026, 7:09 PM`. Replaces a bare `toLocaleString()`. */
export function formatAdminDateTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return PLACEHOLDER;
  return d.toLocaleString('en-US', {
    timeZone: ADMIN_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Date only, e.g. `Jun 25, 2026`. Replaces a bare `toLocaleDateString()`. */
export function formatAdminDate(value: DateInput): string {
  const d = toDate(value);
  if (!d) return PLACEHOLDER;
  return d.toLocaleDateString('en-US', {
    timeZone: ADMIN_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Compact date + time without year, e.g. `Jun 25, 7:09 PM`. For dense tables. */
export function formatAdminDateTimeShort(value: DateInput): string {
  const d = toDate(value);
  if (!d) return PLACEHOLDER;
  return d.toLocaleString('en-US', {
    timeZone: ADMIN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
