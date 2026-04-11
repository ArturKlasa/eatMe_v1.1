'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase, formatLocationForSupabase } from '@/lib/supabase';
import {
  type EditableMenu,
  type EditableDish,
  type ConfirmPayload,
  newEmptyDish,
  countDishes,
  buildConfirmPayload,
} from '@/lib/menu-scan';
import { fetchDishCategories, type DishCategory } from '@/lib/dish-categories';
import type {
  RestaurantOption,
  DietaryTagOption,
  RestaurantDetailsForm,
  Step,
} from './menuScanTypes';
import { useIngredientState } from './useIngredientState';

interface ReviewDeps {
  selectedRestaurant: RestaurantOption | null;
  previewUrls: string[];
  setStep: (step: Step) => void;
}

/** Manages review-phase state: menu/dish editing, ingredient resolution, save */
export function useReviewState(deps: ReviewDeps) {
  // ---------- review step state ----------
  const [jobId, setJobId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [editableMenus, setEditableMenus] = useState<EditableMenu[]>([]);
  const [dishCategories, setDishCategories] = useState<DishCategory[]>([]);
  const [dietaryTags, setDietaryTags] = useState<DietaryTagOption[]>([]);
  const [expandedDishes, setExpandedDishes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // ---------- done step ----------
  const [savedCount, setSavedCount] = useState(0);

  // ---------- restaurant details ----------
  const [restaurantDetails, setRestaurantDetails] = useState<RestaurantDetailsForm>({
    address: '',
    city: '',
    neighbourhood: '',
    state: '',
    postal_code: '',
    country_code: 'MX',
    phone: '',
    website: '',
    lat: null,
    lng: null,
    dirty: false,
  });
  const updateRestaurantDetails = (patch: Partial<RestaurantDetailsForm>) =>
    setRestaurantDetails(prev => ({ ...prev, ...patch, dirty: true }));

  // ---------- UI state ----------
  const [leftPanelTab, setLeftPanelTab] = useState<'images' | 'details'>('images');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // ---------- ingredient sub-hook ----------
  const ingredient = useIngredientState({
    editableMenus,
    setEditableMenus,
    dishCategories,
    setDishCategories,
  });

  // ---------- load supporting data on mount ----------
  useEffect(() => {
    fetchDishCategories().then(({ data }) => setDishCategories(data));

    supabase
      .from('dietary_tags')
      .select('id, code, name')
      .order('name')
      .then(({ data }) => setDietaryTags((data as DietaryTagOption[]) ?? []));
  }, []);

  // ---------- save handler ----------
  const handleSave = async () => {
    if (!deps.selectedRestaurant || !jobId) return;

    const total = countDishes(editableMenus);
    if (total === 0) {
      toast.error('No dishes to save');
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired — please reload');

      if (restaurantDetails.dirty) {
        const patch: Record<string, unknown> = {};
        if (restaurantDetails.address.trim()) patch.address = restaurantDetails.address.trim();
        if (restaurantDetails.city.trim()) patch.city = restaurantDetails.city.trim();
        if (restaurantDetails.neighbourhood.trim())
          patch.neighbourhood = restaurantDetails.neighbourhood.trim();
        if (restaurantDetails.state.trim()) patch.state = restaurantDetails.state.trim();
        if (restaurantDetails.postal_code.trim())
          patch.postal_code = restaurantDetails.postal_code.trim();
        if (restaurantDetails.country_code) patch.country_code = restaurantDetails.country_code;
        if (restaurantDetails.phone.trim()) patch.phone = restaurantDetails.phone.trim();
        if (restaurantDetails.website.trim()) patch.website = restaurantDetails.website.trim();
        if (restaurantDetails.lat && restaurantDetails.lng)
          patch.location = formatLocationForSupabase(restaurantDetails.lat, restaurantDetails.lng);
        const { error: patchErr } = await supabase
          .from('restaurants')
          .update(patch)
          .eq('id', deps.selectedRestaurant.id);
        if (patchErr) console.warn('[MenuScan] Restaurant patch failed:', patchErr.message);
      }

      const payload: ConfirmPayload = buildConfirmPayload(
        editableMenus,
        jobId,
        deps.selectedRestaurant.id
      );

      const response = await fetch('/api/menu-scan/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Commit failed');

      if (data.warnings?.length) {
        toast.warning(`Saved with ${data.warnings.length} warning(s). Check console.`);
        console.warn('[MenuScan] Commit warnings:', data.warnings);
      }

      setSavedCount(data.dishes_saved);
      deps.previewUrls.forEach(url => URL.revokeObjectURL(url));
      deps.setStep('done');
      toast.success(`${data.dishes_saved} dishes saved!`);
    } catch (err: unknown) {
      console.error('[MenuScan] Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ---------- nested state updaters ----------
  const updateMenu = (mIdx: number, patch: Partial<EditableMenu>) => {
    setEditableMenus(prev => prev.map((m, i) => (i === mIdx ? { ...m, ...patch } : m)));
  };

  const updateCategory = (mIdx: number, cIdx: number, patch: { name?: string }) => {
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => (ci === cIdx ? { ...c, ...patch } : c)),
        };
      })
    );
  };

  const updateDish = (mIdx: number, cIdx: number, dIdx: number, patch: Partial<EditableDish>) => {
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            return {
              ...c,
              dishes: c.dishes.map((d, di) => (di === dIdx ? { ...d, ...patch } : d)),
            };
          }),
        };
      })
    );
  };

  const deleteDish = (mIdx: number, cIdx: number, dIdx: number) => {
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            return { ...c, dishes: c.dishes.filter((_, di) => di !== dIdx) };
          }),
        };
      })
    );
  };

  const addDish = (mIdx: number, cIdx: number) => {
    const dish = newEmptyDish();
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            return { ...c, dishes: [...c.dishes, dish] };
          }),
        };
      })
    );
    setExpandedDishes(prev => new Set([...prev, dish._id]));
  };

  const deleteCategory = (mIdx: number, cIdx: number) => {
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return { ...m, categories: m.categories.filter((_, ci) => ci !== cIdx) };
      })
    );
  };

  const addCategory = (mIdx: number) => {
    setEditableMenus(prev =>
      prev.map((m, mi) => {
        if (mi !== mIdx) return m;
        return { ...m, categories: [...m.categories, { name: 'New Category', dishes: [] }] };
      })
    );
  };

  const deleteMenu = (mIdx: number) => {
    setEditableMenus(prev => prev.filter((_, mi) => mi !== mIdx));
  };

  const addMenu = () => {
    setEditableMenus(prev => [...prev, { name: 'New Menu', menu_type: 'food', categories: [] }]);
  };

  const toggleExpand = (dishId: string) => {
    setExpandedDishes(prev => {
      const next = new Set(prev);
      if (next.has(dishId)) next.delete(dishId);
      else next.add(dishId);
      return next;
    });
  };

  const updateDishById = (dishId: string, updates: Partial<EditableDish>) => {
    setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => (d._id === dishId ? { ...d, ...updates } : d)),
        })),
      }))
    );
  };

  return {
    // State
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

    // Ingredient state & actions (spread from sub-hook)
    ...ingredient,

    // Actions
    handleSave,
    updateMenu,
    updateCategory,
    updateDish,
    deleteDish,
    addDish,
    deleteCategory,
    addCategory,
    deleteMenu,
    addMenu,
    toggleExpand,
    updateDishById,
  };
}
