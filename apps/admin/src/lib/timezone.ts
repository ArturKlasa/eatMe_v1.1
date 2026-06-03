import tzlookup from 'tz-lookup';

/**
 * Derive a restaurant's IANA timezone from its coordinates.
 *
 * Used at import time (places.ts) so the feed Edge Function can evaluate
 * open_hours — stored in the restaurant's LOCAL time — against the correct
 * zone (see migration 149 + feed/index.ts isOpenNow). Lat/lng-precise, so it's
 * correct even within multi-timezone countries where a country_code -> zone
 * guess would be off (e.g. Tijuana/Cancún vs Mexico City).
 *
 * Returns null when coordinates are missing or out of range; the feed then
 * falls back to country_code -> zone.
 */
export function deriveTimezone(
  lat: number | null | undefined,
  lng: number | null | undefined
): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  try {
    return tzlookup(lat, lng);
  } catch {
    return null; // tz-lookup throws on out-of-range; treat as unknown
  }
}
