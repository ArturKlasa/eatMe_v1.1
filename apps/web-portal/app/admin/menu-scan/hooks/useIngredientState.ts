'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  type EditableMenu,
  type EditableDish,
  type EditableIngredient,
} from '@/lib/menu-scan';
import { fetchDishCategories, type DishCategory } from '@/lib/dish-categories';
import type { AddIngredientTarget } from './menuScanTypes';

interface IngredientDeps {
  editableMenus: EditableMenu[];
  setEditableMenus: React.Dispatch<React.SetStateAction<EditableMenu[]>>;
  dishCategories: DishCategory[];
  setDishCategories: React.Dispatch<React.SetStateAction<DishCategory[]>>;
}

/** Manages ingredient resolution, AI suggestion, and sub-ingredient editing */
export function useIngredientState(deps: IngredientDeps) {
  const { editableMenus, setEditableMenus, dishCategories, setDishCategories } = deps;

  const [addIngredientTarget, setAddIngredientTarget] = useState<AddIngredientTarget | null>(null);
  const [suggestingDishId, setSuggestingDishId] = useState<string | null>(null);
  const [isSuggestingAll, setIsSuggestingAll] = useState(false);
  const [suggestAllProgress, setSuggestAllProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [inlineSearchTarget, setInlineSearchTarget] = useState<{
    mIdx: number;
    cIdx: number;
    dIdx: number;
  } | null>(null);
  const [subIngredientEditTarget, setSubIngredientEditTarget] = useState<{
    mIdx: number;
    cIdx: number;
    dIdx: number;
    ingIdx: number;
  } | null>(null);

  const resolveIngredient = (
    mIdx: number,
    cIdx: number,
    dIdx: number,
    rawText: string,
    resolved: EditableIngredient
  ) => {
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            return {
              ...c,
              dishes: c.dishes.map((d, di) => {
                if (di !== dIdx) return d;
                const updatedIngredients = d.ingredients.map(ing =>
                  ing.raw_text === rawText ? resolved : ing
                );
                return { ...d, ingredients: updatedIngredients };
              }),
            };
          }),
        };
      })
    );
  };

  const addIngredientToDish = (
    mIdx: number,
    cIdx: number,
    dIdx: number,
    ing: EditableIngredient
  ) => {
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            return {
              ...c,
              dishes: c.dishes.map((d, di) => {
                if (di !== dIdx) return d;
                const alreadyHas = d.ingredients.some(
                  i =>
                    i.canonical_ingredient_id &&
                    i.canonical_ingredient_id === ing.canonical_ingredient_id
                );
                if (alreadyHas) return d;
                return { ...d, ingredients: [...d.ingredients, ing] };
              }),
            };
          }),
        };
      })
    );
  };

  const removeIngredientFromDish = (mIdx: number, cIdx: number, dIdx: number, ingIdx: number) => {
    if (
      subIngredientEditTarget?.mIdx === mIdx &&
      subIngredientEditTarget?.cIdx === cIdx &&
      subIngredientEditTarget?.dIdx === dIdx
    ) {
      if (subIngredientEditTarget.ingIdx === ingIdx) {
        setSubIngredientEditTarget(null);
      } else if (subIngredientEditTarget.ingIdx > ingIdx) {
        setSubIngredientEditTarget(prev => (prev ? { ...prev, ingIdx: prev.ingIdx - 1 } : null));
      }
    }
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            return {
              ...c,
              dishes: c.dishes.map((d, di) => {
                if (di !== dIdx) return d;
                return { ...d, ingredients: d.ingredients.filter((_, ii) => ii !== ingIdx) };
              }),
            };
          }),
        };
      })
    );
  };

  const addSubIngredient = (
    mIdx: number,
    cIdx: number,
    dIdx: number,
    ingIdx: number,
    sub: EditableIngredient
  ) => {
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            return {
              ...c,
              dishes: c.dishes.map((d, di) => {
                if (di !== dIdx) return d;
                return {
                  ...d,
                  ingredients: d.ingredients.map((ing, ii) => {
                    if (ii !== ingIdx) return ing;
                    const existing = ing.sub_ingredients ?? [];
                    if (
                      sub.canonical_ingredient_id &&
                      existing.some(s => s.canonical_ingredient_id === sub.canonical_ingredient_id)
                    )
                      return ing;
                    return { ...ing, sub_ingredients: [...existing, sub] };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const removeSubIngredient = (
    mIdx: number,
    cIdx: number,
    dIdx: number,
    ingIdx: number,
    subIdx: number
  ) => {
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            return {
              ...c,
              dishes: c.dishes.map((d, di) => {
                if (di !== dIdx) return d;
                return {
                  ...d,
                  ingredients: d.ingredients.map((ing, ii) => {
                    if (ii !== ingIdx) return ing;
                    return {
                      ...ing,
                      sub_ingredients: (ing.sub_ingredients ?? []).filter(
                        (_, si) => si !== subIdx
                      ),
                    };
                  }),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const suggestIngredients = async (
    dishId: string,
    dishName: string,
    description: string,
    mIdx: number,
    cIdx: number,
    dIdx: number
  ) => {
    setSuggestingDishId(dishId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Session expired');
        return;
      }

      const res = await fetch('/api/menu-scan/suggest-ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          dish_name: dishName,
          description: description || null,
          dish_category_names: dishCategories.map(dc => dc.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Suggestion failed');

      const suggestions: EditableIngredient[] = data.ingredients ?? [];
      const rawTags: string[] = data.dietary_tags ?? [];
      const effectiveDietaryTags =
        rawTags.includes('vegan') && !rawTags.includes('vegetarian')
          ? [...rawTags, 'vegetarian']
          : rawTags;
      const suggestedAllergens: string[] = data.allergens ?? [];
      const suggestedSpice: 'none' | 'mild' | 'hot' | null = data.spice_level ?? null;
      const suggestedCategoryId: string | null = data.dish_category_id ?? null;
      const suggestedCategoryName: string | null = data.dish_category_name ?? null;

      if (suggestedCategoryId && !dishCategories.some(dc => dc.id === suggestedCategoryId)) {
        fetchDishCategories().then(({ data: freshCats }) => setDishCategories(freshCats));
      }

      const snap = editableMenus[mIdx]?.categories[cIdx]?.dishes[dIdx];
      const snapIds = new Set(
        (snap?.ingredients ?? []).map(i => i.canonical_ingredient_id).filter(Boolean)
      );
      const toAddCount = suggestions.filter(
        i => !i.canonical_ingredient_id || !snapIds.has(i.canonical_ingredient_id)
      ).length;
      const newTagsCount = effectiveDietaryTags.filter(
        t => !(snap?.dietary_tags ?? []).includes(t)
      ).length;
      const parts: string[] = [];
      if (toAddCount > 0) parts.push(`${toAddCount} ingredient${toAddCount !== 1 ? 's' : ''}`);
      if (newTagsCount > 0)
        parts.push(`${newTagsCount} dietary tag${newTagsCount !== 1 ? 's' : ''}`);
      if (suggestedSpice !== null && snap?.spice_level === null) parts.push('spice level');
      if (suggestedAllergens.length > 0)
        parts.push(
          `${suggestedAllergens.length} allergen hint${suggestedAllergens.length !== 1 ? 's' : ''}`
        );
      if (suggestedCategoryId && !snap?.dish_category_id)
        parts.push(`category: ${suggestedCategoryName ?? 'assigned'}`);

      setEditableMenus(prev =>
        prev.map((m, mi) => {
          if (mi !== mIdx) return m;
          return {
            ...m,
            categories: m.categories.map((c, ci) => {
              if (ci !== cIdx) return c;
              return {
                ...c,
                dishes: c.dishes.map((d, di) => {
                  if (di !== dIdx) return d;

                  const existingIdsSet = new Set(
                    d.ingredients
                      .map(i => i.canonical_ingredient_id)
                      .filter((id): id is string => Boolean(id))
                  );
                  const toAdd = suggestions.filter(
                    i =>
                      !i.canonical_ingredient_id || !existingIdsSet.has(i.canonical_ingredient_id)
                  );

                  const patch: Partial<EditableDish> = {};

                  if (toAdd.length > 0) patch.ingredients = [...d.ingredients, ...toAdd];

                  const newTags = effectiveDietaryTags.filter(t => !d.dietary_tags.includes(t));
                  if (newTags.length > 0) patch.dietary_tags = [...d.dietary_tags, ...newTags];

                  if (suggestedSpice !== null && d.spice_level === null)
                    patch.spice_level = suggestedSpice;

                  if (suggestedAllergens.length > 0) patch.suggested_allergens = suggestedAllergens;

                  if (suggestedCategoryId && !d.dish_category_id)
                    patch.dish_category_id = suggestedCategoryId;

                  return Object.keys(patch).length > 0 ? { ...d, ...patch } : d;
                }),
              };
            }),
          };
        })
      );

      if (parts.length === 0) {
        toast.info('No new suggestions to add');
      } else {
        toast.success(`Suggested: ${parts.join(', ')}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suggestion failed');
    } finally {
      setSuggestingDishId(null);
    }
  };

  /** Run AI suggestions for every food dish that has no ingredients yet, 3 at a time. */
  const suggestAllDishes = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error('Session expired');
      return;
    }

    type DishCoord = {
      mIdx: number;
      cIdx: number;
      dIdx: number;
      name: string;
      description: string;
    };
    const targets: DishCoord[] = [];
    editableMenus.forEach((menu, mIdx) => {
      if (menu.menu_type === 'drink') return;
      menu.categories.forEach((cat, cIdx) => {
        cat.dishes.forEach((dish, dIdx) => {
          if (dish.name.trim())
            targets.push({ mIdx, cIdx, dIdx, name: dish.name, description: dish.description });
        });
      });
    });

    if (targets.length === 0) {
      toast.info('No dishes to analyse');
      return;
    }

    setIsSuggestingAll(true);
    setSuggestAllProgress({ done: 0, total: targets.length });

    const CONCURRENCY = 3;
    let done = 0;
    let needCategoryRefresh = false;

    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        batch.map(async ({ mIdx, cIdx, dIdx, name, description }) => {
          try {
            const res = await fetch('/api/menu-scan/suggest-ingredients', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                dish_name: name,
                description: description || null,
                dish_category_names: dishCategories.map(dc => dc.name),
              }),
            });
            const data = await res.json();
            if (!res.ok) return;

            const suggestions: EditableIngredient[] = data.ingredients ?? [];
            const rawTags: string[] = data.dietary_tags ?? [];
            const effectiveDietaryTags =
              rawTags.includes('vegan') && !rawTags.includes('vegetarian')
                ? [...rawTags, 'vegetarian']
                : rawTags;
            const suggestedAllergens: string[] = data.allergens ?? [];
            const suggestedSpice: 'none' | 'mild' | 'hot' | null = data.spice_level ?? null;
            const suggestedCatId: string | null = data.dish_category_id ?? null;

            if (suggestedCatId && !dishCategories.some(dc => dc.id === suggestedCatId)) {
              needCategoryRefresh = true;
            }

            setEditableMenus(prev =>
              prev.map((m, mi) => {
                if (mi !== mIdx) return m;
                return {
                  ...m,
                  categories: m.categories.map((c, ci) => {
                    if (ci !== cIdx) return c;
                    return {
                      ...c,
                      dishes: c.dishes.map((d, di) => {
                        if (di !== dIdx) return d;
                        const existingIdsSet = new Set(
                          d.ingredients
                            .map(ing => ing.canonical_ingredient_id)
                            .filter((id): id is string => Boolean(id))
                        );
                        const toAdd = suggestions.filter(
                          ing =>
                            !ing.canonical_ingredient_id ||
                            !existingIdsSet.has(ing.canonical_ingredient_id)
                        );
                        const patch: Partial<EditableDish> = {};
                        if (toAdd.length > 0) patch.ingredients = [...d.ingredients, ...toAdd];
                        const newTags = effectiveDietaryTags.filter(
                          t => !d.dietary_tags.includes(t)
                        );
                        if (newTags.length > 0)
                          patch.dietary_tags = [...d.dietary_tags, ...newTags];
                        if (suggestedSpice !== null && d.spice_level === null)
                          patch.spice_level = suggestedSpice;
                        if (suggestedAllergens.length > 0)
                          patch.suggested_allergens = suggestedAllergens;
                        if (suggestedCatId && !d.dish_category_id)
                          patch.dish_category_id = suggestedCatId;
                        return Object.keys(patch).length > 0 ? { ...d, ...patch } : d;
                      }),
                    };
                  }),
                };
              })
            );
          } catch {
            // Non-fatal: continue with other dishes
          }
        })
      );
      done += batch.length;
      setSuggestAllProgress({ done, total: targets.length });
    }

    setIsSuggestingAll(false);
    setSuggestAllProgress(null);

    if (needCategoryRefresh) {
      fetchDishCategories().then(({ data: freshCats }) => setDishCategories(freshCats));
    }

    toast.success(
      `AI analysis complete for ${targets.length} dish${targets.length !== 1 ? 'es' : ''}`
    );
  };

  return {
    addIngredientTarget,
    setAddIngredientTarget,
    suggestingDishId,
    isSuggestingAll,
    suggestAllProgress,
    inlineSearchTarget,
    setInlineSearchTarget,
    subIngredientEditTarget,
    setSubIngredientEditTarget,
    resolveIngredient,
    addIngredientToDish,
    removeIngredientFromDish,
    addSubIngredient,
    removeSubIngredient,
    suggestIngredients,
    suggestAllDishes,
  };
}
