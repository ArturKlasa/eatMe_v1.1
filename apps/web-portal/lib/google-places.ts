/**
 * Google Places API (New) client library.
 * Handles Nearby Search, Text Search, and field mapping to MappedRestaurant.
 * All API calls are server-side only — GOOGLE_PLACES_API_KEY is never exposed to the client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MappedRestaurant } from './import-types';

// ─── Field Mask ───────────────────────────────────────────────────────────────

const FIELD_MASK = [
  // Essentials tier
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.addressComponents',
  // Enterprise tier
  'places.regularOpeningHours',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  // Enterprise Plus tier
  'places.dineIn',
  'places.delivery',
  'places.takeout',
  'places.reservable',
].join(',');

// ─── Cuisine / Restaurant-type mappings ──────────────────────────────────────

const GOOGLE_TYPE_TO_CUISINE: Record<string, string> = {
  mexican_restaurant: 'Mexican',
  italian_restaurant: 'Italian',
  chinese_restaurant: 'Chinese',
  japanese_restaurant: 'Japanese',
  thai_restaurant: 'Thai',
  indian_restaurant: 'Indian',
  french_restaurant: 'French',
  korean_restaurant: 'Korean',
  vietnamese_restaurant: 'Vietnamese',
  greek_restaurant: 'Greek',
  turkish_restaurant: 'Turkish',
  lebanese_restaurant: 'Lebanese',
  spanish_restaurant: 'Spanish',
  brazilian_restaurant: 'Brazilian',
  american_restaurant: 'American',
  mediterranean_restaurant: 'Mediterranean',
  seafood_restaurant: 'Seafood',
  steak_house: 'Steakhouse',
  sushi_restaurant: 'Sushi',
  pizza_restaurant: 'Pizza',
  hamburger_restaurant: 'American',
  barbecue_restaurant: 'BBQ',
  vegan_restaurant: 'Vegan',
  vegetarian_restaurant: 'Vegetarian',
  ramen_restaurant: 'Japanese',
  breakfast_restaurant: 'Breakfast',
  brunch_restaurant: 'Brunch',
  cafe: 'Cafe',
  bakery: 'Bakery',
  ice_cream_shop: 'Desserts',
};

const GOOGLE_TYPE_TO_RESTAURANT_TYPE: Record<string, string> = {
  restaurant: 'restaurant',
  cafe: 'cafe',
  coffee_shop: 'cafe',
  bakery: 'bakery',
  bar: 'restaurant',
  pub: 'restaurant',
  meal_takeaway: 'restaurant',
  fast_food_restaurant: 'self_service',
  food_court: 'self_service',
};

const GOOGLE_DAY_TO_KEY = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// ─── Google Places API types ──────────────────────────────────────────────────

interface GoogleLatLng {
  latitude: number;
  longitude: number;
}

interface GoogleDisplayName {
  text: string;
  languageCode?: string;
}

interface GoogleAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
  languageCode?: string;
}

interface GoogleOpeningHoursPeriodPoint {
  day: number;   // 0=Sunday … 6=Saturday
  hour: number;
  minute: number;
}

interface GoogleOpeningHoursPeriod {
  open: GoogleOpeningHoursPeriodPoint;
  close?: GoogleOpeningHoursPeriodPoint;
}

interface GoogleRegularOpeningHours {
  openNow?: boolean;
  periods?: GoogleOpeningHoursPeriod[];
}

export interface GooglePlace {
  id?: string;
  displayName?: GoogleDisplayName;
  formattedAddress?: string;
  location?: GoogleLatLng;
  types?: string[];
  primaryType?: string;
  addressComponents?: GoogleAddressComponent[];
  regularOpeningHours?: GoogleRegularOpeningHours;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  dineIn?: boolean;
  delivery?: boolean;
  takeout?: boolean;
  reservable?: boolean;
}

interface GoogleSearchResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
}

// ─── Exponential backoff helper ───────────────────────────────────────────────

async function fetchWithBackoff(url: string, options: RequestInit): Promise<Response> {
  const delays = [1000, 2000, 4000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const response = await fetch(url, options);
    if (response.status !== 429) {
      return response;
    }
    if (attempt < delays.length) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      lastError = new Error(`Google Places API rate limited (429) after ${attempt + 1} retries`);
    }
  }
  throw lastError ?? new Error('Google Places API rate limited');
}

// ─── API key helper ───────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error('GOOGLE_PLACES_API_KEY environment variable is not set');
  }
  return key;
}

// ─── Nearby Search ────────────────────────────────────────────────────────────

/**
 * Searches for restaurants near a lat/lng point within radiusMeters.
 * Returns up to 20 places per call with full details via FieldMask.
 */
export async function nearbySearchRestaurants(
  lat: number,
  lng: number,
  radiusMeters: number,
  pageToken?: string
): Promise<{ places: GooglePlace[]; nextPageToken: string | null }> {
  const apiKey = getApiKey();

  const body: Record<string, unknown> = {
    includedTypes: ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway', 'fast_food_restaurant'],
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
    maxResultCount: 20,
  };

  if (pageToken) {
    body.pageToken = pageToken;
  }

  const response = await fetchWithBackoff(
    'https://places.googleapis.com/v1/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Places Nearby Search failed (${response.status}): ${text}`);
  }

  const data: GoogleSearchResponse = await response.json();
  return {
    places: data.places ?? [],
    nextPageToken: data.nextPageToken ?? null,
  };
}

// ─── Text Search ─────────────────────────────────────────────────────────────

/**
 * Searches for restaurants by text query, biased to a lat/lng + radius area.
 * Used for targeted queries like "tacos in Roma Norte".
 */
export async function textSearchRestaurants(
  query: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  pageToken?: string
): Promise<{ places: GooglePlace[]; nextPageToken: string | null }> {
  const apiKey = getApiKey();

  const body: Record<string, unknown> = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
  };

  if (pageToken) {
    body.pageToken = pageToken;
  }

  const response = await fetchWithBackoff(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Places Text Search failed (${response.status}): ${text}`);
  }

  const data: GoogleSearchResponse = await response.json();
  return {
    places: data.places ?? [],
    nextPageToken: data.nextPageToken ?? null,
  };
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/**
 * Infers cuisine types from Google place types array.
 * Returns deduplicated list of known cuisine strings.
 */
export function inferCuisineFromGoogleTypes(types: string[]): string[] {
  const cuisines: string[] = [];
  for (const type of types) {
    const cuisine = GOOGLE_TYPE_TO_CUISINE[type];
    if (cuisine && !cuisines.includes(cuisine)) {
      cuisines.push(cuisine);
    }
  }
  return cuisines;
}

/**
 * Converts Google address components to structured fields.
 * Handles Mexican address conventions (delegación, colonia, estado).
 */
export function mapAddressComponents(components: GoogleAddressComponent[]): {
  city?: string;
  state?: string;
  postal_code?: string;
  country_code: string;
  neighbourhood?: string;
} {
  let city: string | undefined;
  let state: string | undefined;
  let postal_code: string | undefined;
  let country_code = 'MX';
  let neighbourhood: string | undefined;

  for (const comp of components) {
    const types = comp.types;

    if (types.includes('country')) {
      country_code = comp.shortText || 'MX';
    } else if (types.includes('postal_code')) {
      postal_code = comp.longText;
    } else if (types.includes('administrative_area_level_1')) {
      state = comp.longText;
    } else if (
      types.includes('locality') ||
      types.includes('sublocality') ||
      types.includes('administrative_area_level_2')
    ) {
      // Prefer locality; sublocality / admin_level_2 are used for Mexican delegaciones
      if (!city || types.includes('locality')) {
        city = comp.longText;
      }
    } else if (
      types.includes('neighborhood') ||
      types.includes('sublocality_level_1')
    ) {
      // Colonia in Mexico City
      if (!neighbourhood) {
        neighbourhood = comp.longText;
      }
    }
  }

  return { city, state, postal_code, country_code, neighbourhood };
}

/**
 * Converts Google regularOpeningHours.periods[] to our open_hours JSONB format.
 * Edge cases: 24h, overnight (close.day != open.day), multiple periods per day.
 */
export function mapGoogleHoursToOpenHours(
  periods: GoogleOpeningHoursPeriod[] | undefined | null
): Record<string, { open: string; close: string }> {
  if (!periods || periods.length === 0) return {};

  // Accumulate open/close ranges per day (in minutes from midnight)
  const dayRanges: Map<number, { openMin: number; closeMin: number }[]> = new Map();

  for (const period of periods) {
    const openDay = period.open.day;
    const openMin = period.open.hour * 60 + period.open.minute;

    let closeMin: number;
    if (!period.close) {
      // 24h — no close entry
      closeMin = 23 * 60 + 59;
    } else {
      closeMin = period.close.hour * 60 + period.close.minute;
      // Detect 24h: open 0:00 with close 0:00 on next day
      if (
        openMin === 0 &&
        period.close.hour === 0 &&
        period.close.minute === 0 &&
        period.close.day !== openDay
      ) {
        closeMin = 23 * 60 + 59;
      } else if (period.close.day !== openDay && period.close.day !== undefined) {
        // Overnight: store close time on the open day (e.g., Fri 18:00 → Sat 02:00)
        // closeMin stays as the actual minute value (e.g., 120 for 02:00)
      }
    }

    if (!dayRanges.has(openDay)) {
      dayRanges.set(openDay, []);
    }
    dayRanges.get(openDay)!.push({ openMin, closeMin });
  }

  const result: Record<string, { open: string; close: string }> = {};

  for (const [day, ranges] of dayRanges) {
    const key = GOOGLE_DAY_TO_KEY[day];
    if (!key) continue;

    // Multiple periods: use earliest open + latest close
    const earliestOpen = Math.min(...ranges.map((r) => r.openMin));
    const latestClose = Math.max(...ranges.map((r) => r.closeMin));

    const fmt = (min: number) => {
      const h = Math.floor(min / 60).toString().padStart(2, '0');
      const m = (min % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    result[key] = { open: fmt(earliestOpen), close: fmt(latestClose) };
  }

  return result;
}

/**
 * Infers restaurant_type from Google types list.
 * Falls back to 'restaurant'.
 */
function inferRestaurantType(types: string[]): string {
  for (const type of types) {
    const mapped = GOOGLE_TYPE_TO_RESTAURANT_TYPE[type];
    if (mapped) return mapped;
  }
  return 'restaurant';
}

/**
 * Maps a full Google Place object to our MappedRestaurant format.
 */
export function mapGooglePlaceToRestaurant(place: GooglePlace): MappedRestaurant {
  const types = place.types ?? [];
  const addressComponents = place.addressComponents ?? [];
  const { city, state, postal_code, country_code, neighbourhood } =
    mapAddressComponents(addressComponents);

  const cuisine_types = inferCuisineFromGoogleTypes(types);
  const restaurant_type = inferRestaurantType(types);

  const open_hours = mapGoogleHoursToOpenHours(place.regularOpeningHours?.periods);

  return {
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
    phone: place.nationalPhoneNumber ?? undefined,
    website: place.websiteUri ?? undefined,
    restaurant_type,
    cuisine_types,
    country_code,
    city,
    state,
    postal_code,
    neighbourhood,
    open_hours: Object.keys(open_hours).length > 0 ? open_hours : undefined,
    delivery_available: place.delivery ?? undefined,
    takeout_available: place.takeout ?? undefined,
    dine_in_available: place.dineIn ?? undefined,
    accepts_reservations: place.reservable ?? undefined,
    google_place_id: place.id ?? undefined,
  };
}

// ─── API usage tracking ───────────────────────────────────────────────────────

function currentMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function getMonthlyApiUsage(
  supabase: SupabaseClient
): Promise<{ calls: number; estimatedCost: number }> {
  const month = currentMonth();
  const { data } = await supabase
    .from('google_api_usage')
    .select('api_calls, estimated_cost_usd')
    .eq('month', month)
    .maybeSingle();

  if (!data) return { calls: 0, estimatedCost: 0 };
  return { calls: data.api_calls ?? 0, estimatedCost: Number(data.estimated_cost_usd ?? 0) };
}

export async function incrementApiUsage(
  supabase: SupabaseClient,
  calls: number
): Promise<void> {
  const month = currentMonth();
  // Cost: Enterprise Plus tier — $40 per 1,000 calls
  const costPerCall = 0.04;
  const additionalCost = calls * costPerCall;

  // Try upsert: insert row if missing, otherwise increment
  const { data: existing } = await supabase
    .from('google_api_usage')
    .select('id, api_calls, estimated_cost_usd')
    .eq('month', month)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('google_api_usage')
      .update({
        api_calls: (existing.api_calls ?? 0) + calls,
        estimated_cost_usd: Number(existing.estimated_cost_usd ?? 0) + additionalCost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('google_api_usage').insert({
      month,
      api_calls: calls,
      estimated_cost_usd: additionalCost,
      updated_at: new Date().toISOString(),
    });
  }
}
