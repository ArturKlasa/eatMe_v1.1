import { supabase } from './supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export interface DishCategory {
  id: string;
  name: string;
  parent_category_id?: string | null;
  is_drink: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface DishCategoryInsert {
  name: string;
  parent_category_id?: string | null;
  is_drink?: boolean;
  is_active?: boolean;
}

/** @returns */
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

/** @returns */
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

/** @returns */
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

/** @param category @returns */
export async function createDishCategory(
  category: DishCategoryInsert
): Promise<{ data: DishCategory | null; error: PostgrestError | null }> {
  const { data, error } = await supabase.from('dish_categories').insert(category).select().single();

  return { data, error };
}

/** @param id @param updates @returns */
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

/** Soft-delete by marking inactive. @param id @returns */
export async function deactivateDishCategory(
  id: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from('dish_categories')
    .update({ is_active: false })
    .eq('id', id);

  return { error };
}

/** Permanently delete. @param id @returns */
export async function deleteDishCategory(id: string): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('dish_categories').delete().eq('id', id);
  return { error };
}
