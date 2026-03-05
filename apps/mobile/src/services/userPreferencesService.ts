/**
 * User Preferences Service
 * Handles saving/loading user preferences to/from Supabase
 */

import { supabase } from '../lib/supabase';
import { type Result, ok, err } from '../lib/result';
import type { PermanentFilters } from '../stores/filterStore';

// ─── Default values ────────────────────────────────────────────────────────────
// Used as fallbacks when DB rows were created before the schema stabilised.

const DEFAULT_ALLERGIES: PermanentFilters['allergies'] = {
  lactose: false,
  gluten: false,
  peanuts: false,
  soy: false,
  sesame: false,
  shellfish: false,
  nuts: false,
};

const DEFAULT_EXCLUDE: PermanentFilters['exclude'] = {
  noMeat: false,
  noFish: false,
  noSeafood: false,
  noEggs: false,
  noDairy: false,
  noSpicy: false,
};

const DEFAULT_DIET_TYPES: PermanentFilters['dietTypes'] = {
  diabetic: false,
  keto: false,
  paleo: false,
  lowCarb: false,
  pescatarian: false,
};

const DEFAULT_RELIGIOUS: PermanentFilters['religiousRestrictions'] = {
  halal: false,
  hindu: false,
  kosher: false,
  jain: false,
  buddhist: false,
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UserPreferencesDB {
  user_id: string;
  diet_preference: 'all' | 'vegetarian' | 'vegan';
  /**
   * Stored as JSONB. Older rows use an object {lactose: boolean, ...},
   * rows created after migration 024 may have an empty array [].
   * Always normalise with normaliseAllergies() before use.
   */
  allergies: PermanentFilters['allergies'] | unknown[] | null;
  exclude: PermanentFilters['exclude'] | null;
  diet_types: PermanentFilters['dietTypes'] | null;
  religious_restrictions: PermanentFilters['religiousRestrictions'] | null;
  default_max_distance: number;
}

// ─── Normalisers ───────────────────────────────────────────────────────────────

/**
 * Migration 032 normalised all existing rows to the object format and fixed
 * the column default. This function is kept as a lightweight safety net for
 * any dev-environment rows that may have been created in between.
 */
function normaliseAllergies(
  raw: PermanentFilters['allergies'] | unknown[] | null
): PermanentFilters['allergies'] {
  if (!raw || Array.isArray(raw)) return { ...DEFAULT_ALLERGIES };
  return { ...DEFAULT_ALLERGIES, ...(raw as Partial<PermanentFilters['allergies']>) };
}

function normaliseObject<T extends object>(raw: T | null | undefined, defaults: T): T {
  if (!raw || Array.isArray(raw)) return { ...defaults };
  return { ...defaults, ...raw };
}

/**
 * Load user preferences from database.
 * Returns ok(null) when the user has no preferences yet (first-time user) — not an error.
 */
export async function loadUserPreferences(
  userId: string
): Promise<Result<UserPreferencesDB | null>> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = no rows returned → first-time user, not an error
      if (error.code === 'PGRST116') return ok(null);
      console.error('[UserPreferences] Error loading preferences:', error);
      return err(error.message);
    }

    return ok(data as unknown as UserPreferencesDB);
  } catch (e) {
    console.error('[UserPreferences] Unexpected error:', e);
    return err(e as Error);
  }
}

/**
 * Save user preferences to database
 */
export async function saveUserPreferences(
  userId: string,
  preferences: Partial<UserPreferencesDB>
): Promise<Result<void>> {
  try {
    const { error } = await (supabase.from('user_preferences') as any).upsert(
      {
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('[UserPreferences] Error saving preferences:', error);
      return err(error.message);
    }

    return ok(undefined);
  } catch (e) {
    console.error('[UserPreferences] Unexpected error:', e);
    return err(e as Error);
  }
}

/**
 * Convert filterStore permanent filters to database format.
 *
 * Note: price range is intentionally excluded — it is session-only state
 * managed by filterStore as a daily filter and should never be persisted
 * to the DB (it is currency-dependent and has no safe canonical form).
 */
export function permanentFiltersToDb(filters: PermanentFilters): Partial<UserPreferencesDB> {
  return {
    diet_preference: filters.dietPreference,
    allergies: filters.allergies,
    exclude: filters.exclude,
    diet_types: filters.dietTypes,
    religious_restrictions: filters.religiousRestrictions,
    default_max_distance: 5, // Could make this configurable
  };
}

/**
 * Convert database preferences to filterStore format.
 *
 * Applies runtime normalisers to handle rows created by different
 * migrations (e.g. allergies may be [] or an object depending on age).
 * Price range is intentionally excluded — see permanentFiltersToDb.
 */
export function dbToPermanentFilters(dbPrefs: UserPreferencesDB): Partial<PermanentFilters> {
  return {
    dietPreference: dbPrefs.diet_preference ?? 'all',
    allergies: normaliseAllergies(dbPrefs.allergies),
    exclude: normaliseObject(dbPrefs.exclude, DEFAULT_EXCLUDE),
    dietTypes: normaliseObject(dbPrefs.diet_types, DEFAULT_DIET_TYPES),
    religiousRestrictions: normaliseObject(dbPrefs.religious_restrictions, DEFAULT_RELIGIOUS),
  };
}

/**
 * Track dish interaction (for recommendations)
 */
export async function trackDishInteraction(
  userId: string,
  dishId: string,
  interactionType: 'viewed' | 'liked' | 'disliked' | 'ordered' | 'saved',
  sessionId?: string
): Promise<Result<void>> {
  try {
    const { error } = await supabase.from('user_dish_interactions').insert({
      user_id: userId,
      dish_id: dishId,
      interaction_type: interactionType,
      session_id: sessionId,
    });

    if (error) {
      console.error('[UserPreferences] Error tracking interaction:', error);
      return err(error.message);
    }

    return ok(undefined);
  } catch (e) {
    console.error('[UserPreferences] Unexpected error:', e);
    return err(e as Error);
  }
}

/**
 * Update user profile name
 */
export async function updateProfileName(
  userId: string,
  profileName: string
): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ profile_name: profileName })
      .eq('id', userId);

    if (error) {
      console.error('[UserPreferences] Error updating profile name:', error);
      return err(error.message);
    }

    return ok(undefined);
  } catch (e) {
    console.error('[UserPreferences] Unexpected error:', e);
    return err(e as Error);
  }
}
