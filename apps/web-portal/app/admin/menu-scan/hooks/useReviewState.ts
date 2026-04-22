'use client';

import { useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { computeMenuWarnings, extractionNotesToWarnings } from '@/lib/menu-scan-warnings';
import { fetchDishCategories } from '@/lib/dish-categories';
import type { DietaryTagOption, RestaurantOption, Step } from './menuScanTypes';
import { useIngredientState } from './useIngredientState';
import { useReviewStore } from '../store';

interface ReviewDeps {
  selectedRestaurant: RestaurantOption | null;
  previewUrls: string[];
  setStep: (step: Step) => void;
  onSaveSuccess?: () => void;
}

export function useReviewState(deps: ReviewDeps) {
  // All state from store
  const jobId = useReviewStore(s => s.jobId);
  const currency = useReviewStore(s => s.currency);
  const editableMenus = useReviewStore(s => s.editableMenus);
  const dishCategories = useReviewStore(s => s.dishCategories);
  const dietaryTags = useReviewStore(s => s.dietaryTags);
  const expandedDishes = useReviewStore(s => s.expandedDishes);
  const extractionNotes = useReviewStore(s => s.extractionNotes);
  const saving = useReviewStore(s => s.saving);
  const savedCount = useReviewStore(s => s.savedCount);
  const restaurantDetails = useReviewStore(s => s.restaurantDetails);
  const leftPanelTab = useReviewStore(s => s.leftPanelTab);
  const lightboxOpen = useReviewStore(s => s.lightboxOpen);

  // Actions from store
  const setJobId = useReviewStore(s => s.setJobId);
  const setCurrency = useReviewStore(s => s.setCurrency);
  const setEditableMenus = useReviewStore(s => s.setEditableMenus);
  const setDishCategories = useReviewStore(s => s.setDishCategories);
  const setDietaryTags = useReviewStore(s => s.setDietaryTags);
  const setExpandedDishes = useReviewStore(s => s.setExpandedDishes);
  const setExtractionNotes = useReviewStore(s => s.setExtractionNotes);
  const setSaving = useReviewStore(s => s.setSaving);
  const setSavedCount = useReviewStore(s => s.setSavedCount);
  const setRestaurantDetails = useReviewStore(s => s.setRestaurantDetails);
  const updateRestaurantDetails = useReviewStore(s => s.updateRestaurantDetails);
  const setLeftPanelTab = useReviewStore(s => s.setLeftPanelTab);
  const setLightboxOpen = useReviewStore(s => s.setLightboxOpen);
  const updateMenu = useReviewStore(s => s.updateMenu);
  const updateCategory = useReviewStore(s => s.updateCategory);
  const updateDish = useReviewStore(s => s.updateDish);
  const deleteDish = useReviewStore(s => s.deleteDish);
  const addDish = useReviewStore(s => s.addDish);
  const addVariantDish = useReviewStore(s => s.addVariantDish);
  const deleteCategory = useReviewStore(s => s.deleteCategory);
  const addCategory = useReviewStore(s => s.addCategory);
  const deleteMenu = useReviewStore(s => s.deleteMenu);
  const addMenu = useReviewStore(s => s.addMenu);
  const toggleExpand = useReviewStore(s => s.toggleExpand);
  const updateDishById = useReviewStore(s => s.updateDishById);
  const storeHandleSave = useReviewStore(s => s.handleSave);

  // Ingredient sub-hook (not yet migrated to store)
  const ingredient = useIngredientState({
    editableMenus,
    setEditableMenus,
    dishCategories,
    setDishCategories,
  });

  // Load supporting data on mount
  useEffect(() => {
    fetchDishCategories().then(({ data }) => setDishCategories(data));
    supabase
      .from('dietary_tags')
      .select('id, code, name')
      .order('name')
      .then(({ data }) => setDietaryTags((data as DietaryTagOption[]) ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const menuWarnings = useMemo(
    () => [
      ...computeMenuWarnings(editableMenus, currency),
      ...extractionNotesToWarnings(extractionNotes),
    ],
    [editableMenus, extractionNotes, currency]
  );

  const handleSave = () => storeHandleSave({ onSaveSuccess: deps.onSaveSuccess });

  return {
    menuWarnings,
    setExtractionNotes,
    jobId,
    setJobId,
    currency,
    setCurrency,
    editableMenus,
    setEditableMenus,
    dishCategories,
    setDishCategories,
    dietaryTags,
    expandedDishes,
    setExpandedDishes,
    saving,
    savedCount,
    setSavedCount,
    restaurantDetails,
    setRestaurantDetails,
    updateRestaurantDetails,
    leftPanelTab,
    setLeftPanelTab,
    lightboxOpen,
    setLightboxOpen,
    ...ingredient,
    handleSave,
    updateMenu,
    updateCategory,
    updateDish,
    deleteDish,
    addDish,
    addVariantDish,
    deleteCategory,
    addCategory,
    deleteMenu,
    addMenu,
    toggleExpand,
    updateDishById,
  };
}
