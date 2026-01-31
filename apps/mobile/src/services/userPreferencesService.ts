/**
 * User Preferences Service
 * Handles saving/loading user preferences to/from Supabase
 */

import { supabase } from '../lib/supabase';
import type { PermanentFilters } from '../stores/filterStore';

export interface UserPreferencesDB {
  user_id: string;
  diet_preference: 'all' | 'vegetarian' | 'vegan';
  allergies: {
    lactose: boolean;
    gluten: boolean;
    peanuts: boolean;
    soy: boolean;
    sesame: boolean;
    shellfish: boolean;
    nuts: boolean;
  };
  exclude: {
    noMeat: boolean;
    noFish: boolean;
    noSeafood: boolean;
    noEggs: boolean;
    noDairy: boolean;
    noSpicy: boolean;
  };
  diet_types: {
    diabetic: boolean;
    keto: boolean;
    paleo: boolean;
    lowCarb: boolean;
    pescatarian: boolean;
  };
  religious_restrictions: {
    halal: boolean;
    hindu: boolean;
    kosher: boolean;
    jain: boolean;
    buddhist: boolean;
  };
  default_price_range: {
    min: number;
    max: number;
  };
  default_max_distance: number;
}

/**
 * Load user preferences from database
 */
export async function loadUserPreferences(
  userId: string
): Promise<{ data: UserPreferencesDB | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no preferences exist yet, return null (not an error)
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      console.error('[UserPreferences] Error loading preferences:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    console.error('[UserPreferences] Unexpected error:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Save user preferences to database
 */
export async function saveUserPreferences(
  userId: string,
  preferences: Partial<UserPreferencesDB>
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

    if (error) {
      console.error('[UserPreferences] Error saving preferences:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[UserPreferences] Unexpected error:', err);
    return { error: err as Error };
  }
}

/**
 * Convert filterStore permanent filters to database format
 */
export function permanentFiltersToDb(filters: PermanentFilters): Partial<UserPreferencesDB> {
  return {
    diet_preference: filters.dietPreference,
    allergies: filters.allergies,
    exclude: filters.exclude,
    diet_types: filters.dietTypes,
    religious_restrictions: filters.religiousRestrictions,
    default_price_range: filters.defaultPriceRange,
    default_max_distance: 5, // Could make this configurable
  };
}

/**
 * Convert database preferences to filterStore format
 */
export function dbToPermanentFilters(dbPrefs: UserPreferencesDB): Partial<PermanentFilters> {
  return {
    dietPreference: dbPrefs.diet_preference,
    allergies: dbPrefs.allergies,
    exclude: dbPrefs.exclude,
    dietTypes: dbPrefs.diet_types,
    religiousRestrictions: dbPrefs.religious_restrictions,
    defaultPriceRange: dbPrefs.default_price_range,
    // Keep other fields from existing state
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
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('user_dish_interactions').insert({
      user_id: userId,
      dish_id: dishId,
      interaction_type: interactionType,
      session_id: sessionId,
    });

    if (error) {
      console.error('[UserPreferences] Error tracking interaction:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[UserPreferences] Unexpected error:', err);
    return { error: err as Error };
  }
}

/**
 * Update user profile name
 */
export async function updateProfileName(
  userId: string,
  profileName: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ profile_name: profileName })
      .eq('id', userId);

    if (error) {
      console.error('[UserPreferences] Error updating profile name:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('[UserPreferences] Unexpected error:', err);
    return { error: err as Error };
  }
}
