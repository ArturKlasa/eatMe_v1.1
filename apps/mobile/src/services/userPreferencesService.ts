import { supabase } from '../lib/supabase';
import { type Result, ok, err } from '../lib/result';
import type { PermanentFilters } from '../stores/filterStore';

// Exclude keys map to user_preferences.exclude codes. noMeat persists as the
// legacy 'vegetarian' code for back-compat with rows written before this change.
const EXCLUDE_TO_DB: Record<keyof PermanentFilters['exclude'], string> = {
  noMeat: 'vegetarian',
  noFish: 'no_fish',
  noSeafood: 'no_seafood',
  noEggs: 'no_eggs',
  noSpicy: 'no_spicy',
};

function toCodeSet(arr: string[] | null | undefined): Set<string> {
  return new Set(Array.isArray(arr) ? arr : []);
}

export interface UserPreferencesDB {
  user_id: string;
  diet_preference: 'all' | 'vegetarian' | 'vegan';
  exclude: string[] | null;
  default_max_distance: number;
}

/** Load user preferences from database. Returns ok(null) for first-time users. */
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

/** Save user preferences to database. */
export async function saveUserPreferences(
  userId: string,
  preferences: Partial<UserPreferencesDB>
): Promise<Result<void>> {
  try {
    const { error } = (await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )) as unknown as { error: { message: string } | null };

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

/** Convert filterStore permanent filters to database format. Price range intentionally excluded (session-only, currency-dependent). */
export function permanentFiltersToDb(filters: PermanentFilters): Partial<UserPreferencesDB> {
  return {
    diet_preference: filters.dietPreference,
    exclude: (Object.entries(filters.exclude) as [keyof PermanentFilters['exclude'], boolean][])
      .filter(([_, active]) => active)
      .map(([key]) => EXCLUDE_TO_DB[key]),
    default_max_distance: 5,
  };
}

/** Convert database preferences to filterStore format. */
export function dbToPermanentFilters(dbPrefs: UserPreferencesDB): Partial<PermanentFilters> {
  const excludeSet = toCodeSet(dbPrefs.exclude);

  return {
    dietPreference: dbPrefs.diet_preference ?? 'all',
    exclude: {
      noMeat: excludeSet.has('vegetarian'),
      noFish: excludeSet.has('no_fish'),
      noSeafood: excludeSet.has('no_seafood'),
      noEggs: excludeSet.has('no_eggs'),
      noSpicy: excludeSet.has('no_spicy'),
    },
  };
}

/** Track dish interaction (for recommendations). */
export async function trackDishInteraction(
  userId: string,
  dishId: string,
  interactionType: 'viewed' | 'liked' | 'disliked' | 'saved',
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

/** Update user profile name. */
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
