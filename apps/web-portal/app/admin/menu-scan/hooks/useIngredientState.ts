'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { type EditableMenu, type EditableDish, type EditableIngredient } from '@/lib/menu-scan';
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
                      sub_ingredients: (ing.sub_ingredients ?? []).filter((_, si) => si !== subIdx),
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

  // Ingredient suggestion is disabled — we only extract primary_protein now.
  // The /api/menu-scan/suggest-ingredients endpoint is retained but no longer wired.
  const suggestIngredients = async (
    _dishId: string,
    _dishName: string,
    _description: string,
    _mIdx: number,
    _cIdx: number,
    _dIdx: number
  ) => {
    return;
  };

  const suggestAllDishes = async () => {
    return;
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
