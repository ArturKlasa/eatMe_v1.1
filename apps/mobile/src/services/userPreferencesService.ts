import { supabase } from '../lib/supabase';
import { type Result, ok, err } from '../lib/result';
import type { PermanentFilters } from '../stores/filterStore';

const ALLERGY_TO_DB: Record<keyof PermanentFilters['allergies'], string> = {
  lactose: 'lactose',
  gluten: 'gluten',
  peanuts: 'peanuts',
  soy: 'soybeans', // JSONB key 'soy' → DB code 'soybeans'
  sesame: 'sesame',
  shellfish: 'shellfish',
  nuts: 'tree_nuts', // JSONB key 'nuts' → DB code 'tree_nuts'
};

const DB_TO_ALLERGY: Record<string, keyof PermanentFilters['allergies']> = {
  lactose: 'lactose',
  gluten: 'gluten',
  peanuts: 'peanuts',
  soybeans: 'soy',
  sesame: 'sesame',
  shellfish: 'shellfish',
  tree_nuts: 'nuts',
};

const EXCLUDE_TO_DB: Record<keyof PermanentFilters['exclude'], string> = {
  noMeat: 'vegetarian',
  noFish: 'no_fish',
  noSeafood: 'no_seafood',
  noEggs: 'no_eggs',
  noDairy: 'dairy_free',
  noSpicy: 'no_spicy',
};

const DB_TO_EXCLUDE: Record<string, keyof PermanentFilters['exclude']> = {
  vegetarian: 'noMeat',
  no_fish: 'noFish',
  no_seafood: 'noSeafood',
  no_eggs: 'noEggs',
  dairy_free: 'noDairy',
  no_spicy: 'noSpicy',
};

const DIET_TYPE_TO_DB: Record<keyof PermanentFilters['dietTypes'], string> = {
  diabetic: 'diabetic',
  keto: 'keto',
  paleo: 'paleo',
  lowCarb: 'low_carb', // camelCase → snake_case
  pescatarian: 'pescatarian',
};

const DB_TO_DIET_TYPE: Record<string, keyof PermanentFilters['dietTypes']> = {
  diabetic: 'diabetic',
  keto: 'keto',
  paleo: 'paleo',
  low_carb: 'lowCarb',
  pescatarian: 'pescatarian',
};

// religiousRestrictions keys match dietary_tags.code directly (halal, kosher, hindu, jain, buddhist)
const RELIGIOUS_KEYS = ['halal', 'hindu', 'kosher', 'jain', 'buddhist'] as const;

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

function toCodeSet(arr: string[] | null | undefined): Set<string> {
  return new Set(Array.isArray(arr) ? arr : []);
}

export interface UserPreferencesDB {
  user_id: string;
  diet_preference: 'all' | 'vegetarian' | 'vegan';
  allergies: string[] | null;
  exclude: string[] | null;
  diet_types: string[] | null;
  religious_restrictions: string[] | null;
  default_max_distance: number;
  ingredients_to_avoid: PermanentFilters['ingredientsToAvoid'] | null;
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
    allergies: (
      Object.entries(filters.allergies) as [keyof PermanentFilters['allergies'], boolean][]
    )
      .filter(([_, active]) => active)
      .map(([key]) => ALLERGY_TO_DB[key]),
    exclude: (Object.entries(filters.exclude) as [keyof PermanentFilters['exclude'], boolean][])
      .filter(([_, active]) => active)
      .map(([key]) => EXCLUDE_TO_DB[key]),
    diet_types: (
      Object.entries(filters.dietTypes) as [keyof PermanentFilters['dietTypes'], boolean][]
    )
      .filter(([_, active]) => active)
      .map(([key]) => DIET_TYPE_TO_DB[key]),
    religious_restrictions: (Object.entries(filters.religiousRestrictions) as [string, boolean][])
      .filter(([_, active]) => active)
      .map(([key]) => key), // keys match dietary_tags.code directly
    default_max_distance: 5,
    ingredients_to_avoid: filters.ingredientsToAvoid,
  };
}

/** Convert database preferences to filterStore format. */
export function dbToPermanentFilters(dbPrefs: UserPreferencesDB): Partial<PermanentFilters> {
  const allergySet = toCodeSet(dbPrefs.allergies);
  const excludeSet = toCodeSet(dbPrefs.exclude);
  const dietSet = toCodeSet(dbPrefs.diet_types);
  const religiousSet = toCodeSet(dbPrefs.religious_restrictions);

  return {
    dietPreference: dbPrefs.diet_preference ?? 'all',
    allergies: {
      lactose: allergySet.has('lactose'),
      gluten: allergySet.has('gluten'),
      peanuts: allergySet.has('peanuts'),
      soy: allergySet.has('soybeans'),
      sesame: allergySet.has('sesame'),
      shellfish: allergySet.has('shellfish'),
      nuts: allergySet.has('tree_nuts'),
    },
    exclude: {
      noMeat: excludeSet.has('vegetarian'),
      noFish: excludeSet.has('no_fish'),
      noSeafood: excludeSet.has('no_seafood'),
      noEggs: excludeSet.has('no_eggs'),
      noDairy: excludeSet.has('dairy_free'),
      noSpicy: excludeSet.has('no_spicy'),
    },
    dietTypes: {
      diabetic: dietSet.has('diabetic'),
      keto: dietSet.has('keto'),
      paleo: dietSet.has('paleo'),
      lowCarb: dietSet.has('low_carb'),
      pescatarian: dietSet.has('pescatarian'),
    },
    religiousRestrictions: {
      halal: religiousSet.has('halal'),
      hindu: religiousSet.has('hindu'),
      kosher: religiousSet.has('kosher'),
      jain: religiousSet.has('jain'),
      buddhist: religiousSet.has('buddhist'),
    },
    ingredientsToAvoid: Array.isArray(dbPrefs.ingredients_to_avoid)
      ? dbPrefs.ingredients_to_avoid
      : [],
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
