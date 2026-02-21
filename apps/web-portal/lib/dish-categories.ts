import { supabase } from './supabase';
import type { PostgrestError } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface DishCategory {
  id: string;
  name: string;
  slug: string;
  parent_category_id?: string | null;
  is_drink: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DishCategoryInsert {
  name: string;
  slug?: string; // Auto-generated from name if not provided
  parent_category_id?: string | null;
  is_drink?: boolean;
  is_active?: boolean;
}

// ============================================================================
// Read helpers
// ============================================================================

/** Fetch all active dish categories ordered by display_order. */
export async function fetchDishCategories(): Promise<{
  data: DishCategory[];
  error: PostgrestError | null;
}> {
  const { data, error } = await supabase
    .from('dish_categories')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return { data: data ?? [], error };
}

/** Fetch food-only (is_drink = false) categories. */
export async function fetchFoodCategories(): Promise<{
  data: DishCategory[];
  error: PostgrestError | null;
}> {
  const { data, error } = await supabase
    .from('dish_categories')
    .select('*')
    .eq('is_active', true)
    .eq('is_drink', false)
    .order('name', { ascending: true });

  return { data: data ?? [], error };
}

/** Fetch drink-only (is_drink = true) categories. */
export async function fetchDrinkCategories(): Promise<{
  data: DishCategory[];
  error: PostgrestError | null;
}> {
  const { data, error } = await supabase
    .from('dish_categories')
    .select('*')
    .eq('is_active', true)
    .eq('is_drink', true)
    .order('name', { ascending: true });

  return { data: data ?? [], error };
}

// ============================================================================
// Admin write helpers
// ============================================================================

/** Create a new dish category. Requires admin role (enforced by RLS). */
export async function createDishCategory(
  category: DishCategoryInsert
): Promise<{ data: DishCategory | null; error: PostgrestError | null }> {
  const { data, error } = await supabase.from('dish_categories').insert(category).select().single();

  return { data, error };
}

/** Update an existing dish category. Requires admin role (enforced by RLS). */
export async function updateDishCategory(
  id: string,
  updates: Partial<DishCategoryInsert>
): Promise<{ data: DishCategory | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('dish_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

/** Soft-delete a dish category by marking it inactive. Requires admin role. */
export async function deactivateDishCategory(
  id: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('dish_categories')
    .update({ is_active: false })
    .eq('id', id);

  return { error };
}

/** Permanently delete a dish category. Use with caution. */
export async function deleteDishCategory(id: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('dish_categories').delete().eq('id', id);
  return { error };
}
