'use client';
import { useReviewStore } from '../store';
import type { EditableMenu } from '@/lib/menu-scan';
import type { DishCategory } from '@/lib/dish-categories';

interface IngredientDeps {
  editableMenus: EditableMenu[];
  setEditableMenus: React.Dispatch<React.SetStateAction<EditableMenu[]>>;
  dishCategories: DishCategory[];
  setDishCategories: React.Dispatch<React.SetStateAction<DishCategory[]>>;
}

/** Thin store wrapper — all ingredient state and actions live in the Zustand store */
export function useIngredientState(_deps: IngredientDeps) {
  const addIngredientTarget = useReviewStore(s => s.addIngredientTarget);
  const setAddIngredientTarget = useReviewStore(s => s.setAddIngredientTarget);
  const suggestingDishId = useReviewStore(s => s.suggestingDishId);
  const isSuggestingAll = useReviewStore(s => s.isSuggestingAll);
  const suggestAllProgress = useReviewStore(s => s.suggestAllProgress);
  const inlineSearchTarget = useReviewStore(s => s.inlineSearchTarget);
  const setInlineSearchTarget = useReviewStore(s => s.setInlineSearchTarget);
  const subIngredientEditTarget = useReviewStore(s => s.subIngredientEditTarget);
  const setSubIngredientEditTarget = useReviewStore(s => s.setSubIngredientEditTarget);
  const resolveIngredient = useReviewStore(s => s.resolveIngredient);
  const addIngredientToDish = useReviewStore(s => s.addIngredientToDish);
  const removeIngredientFromDish = useReviewStore(s => s.removeIngredientFromDish);
  const addSubIngredient = useReviewStore(s => s.addSubIngredient);
  const removeSubIngredient = useReviewStore(s => s.removeSubIngredient);
  const suggestIngredients = useReviewStore(s => s.suggestIngredients);
  const suggestAllDishes = useReviewStore(s => s.suggestAllDishes);

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
