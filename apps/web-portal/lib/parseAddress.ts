/**
 * Utility for parsing Nominatim reverse geocoding responses into structured
 * address fields. Used by LocationPicker to auto-populate form inputs on map click.
 *
 * Nominatim returns a `display_name` like:
 *   "50, Calle Río Atoyac, Cuauhtémoc, Mexico City, Cuauhtémoc, Mexico City, 06500, Mexico"
 * and an `address` object with typed fields. We prefer the structured object
 * for reliability but can fall back to parsing the display string if needed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The `address` object returned by Nominatim when `addressdetails=1` is set.
 * Only the fields we care about are typed; the real response may include more.
 */
export interface NominatimAddressDetails {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  /** Primary city field */
  city?: string;
  /** Used for towns instead of cities */
  town?: string;
  /** Used for small settlements */
  village?: string;
  /** Used in some countries instead of city/town */
  municipality?: string;
  /** Administrative county / district */
  county?: string;
  /** State / province */
  state?: string;
  /** Postal / ZIP code */
  postcode?: string;
  /** Full country name (e.g. "Mexico") */
  country?: string;
  /** ISO 3166-1 alpha-2 country code in LOWERCASE (e.g. "mx") */
  country_code?: string;
}

/** Structured address information ready to populate form fields. */
export interface ParsedLocationDetails {
  /** The raw `display_name` from Nominatim */
  displayName: string;
  /**
   * Street-level address built from house_number + road.
   * May be empty if the clicked location has no road info.
   */
  streetAddress: string;
  /** Neighbourhood / suburb name, or empty string */
  neighbourhood: string;
  /** Best available city/town/village name */
  city: string;
  /** State / province / region, or empty string */
  state: string;
  /** Postal / ZIP code, or empty string */
  postalCode: string;
  /**
   * ISO 3166-1 alpha-2 country code in UPPERCASE (e.g. "MX", "US").
   * This matches the `value` field in the COUNTRIES constant so callers can
   * directly compare/set the country selector without extra transformation.
   * Empty string when not available.
   */
  countryCode: string;
  /** Full country name as returned by Nominatim (e.g. "Mexico") */
  countryName: string;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses a Nominatim reverse-geocoding response into structured address fields.
 *
 * Handles the variety of city-level keys Nominatim may use depending on the
 * settlement type (city / town / village / municipality / county) so callers
 * don't need to worry about those differences.
 *
 * @param displayName  The `display_name` string from the Nominatim response.
 * @param address      The `address` object from the Nominatim response.
 *                     Requires `addressdetails=1` in the request URL.
 * @returns            A `ParsedLocationDetails` object ready to populate form
 *                     fields such as country, city, postal code and address.
 *
 * @example
 * const details = parseNominatimAddress(
 *   "50, Calle Río Atoyac, ..., 06500, Mexico",
 *   { house_number: "50", road: "Calle Río Atoyac", city: "Mexico City",
 *     postcode: "06500", country: "Mexico", country_code: "mx" }
 * );
 * // details.city       → "Mexico City"
 * // details.postalCode → "06500"
 * // details.countryCode → "MX"
 */
export function parseNominatimAddress(
  displayName: string,
  address: NominatimAddressDetails
): ParsedLocationDetails {
  // Build street address from house number + road name
  const streetParts: string[] = [];
  if (address.house_number) streetParts.push(address.house_number);
  if (address.road) streetParts.push(address.road);
  const streetAddress = streetParts.join(' ');

  // Neighbourhood: prefer the named neighbourhood, fall back to suburb
  const neighbourhood = address.neighbourhood ?? address.suburb ?? '';

  // Resolve the city-level name — Nominatim uses different keys depending on
  // how the OSM data classifies the settlement.
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    address.state ??
    '';

  // State / province
  const state = address.state ?? '';

  const postalCode = address.postcode ?? '';

  // Nominatim returns lowercase ISO codes; normalise to uppercase so the value
  // can be matched directly against our COUNTRIES constant (e.g. "mx" → "MX").
  const countryCode = (address.country_code ?? '').toUpperCase();

  const countryName = address.country ?? '';

  return {
    displayName,
    streetAddress,
    neighbourhood,
    city,
    state,
    postalCode,
    countryCode,
    countryName,
  };
}
