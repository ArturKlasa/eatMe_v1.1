import { StateCreator } from 'zustand';
import { toast } from 'sonner';
import { supabase, formatLocationForSupabase } from '@/lib/supabase';
import {
  type EditableMenu,
  type EditableDish,
  type EditableCourse,
  type EditableCourseItem,
  type EnrichedResult,
  type ExtractionNote,
  type ConfirmPayload,
  newEmptyDish,
  newEmptyCourse,
  newEmptyCourseItem,
  toEditableMenus,
  countDishes,
  buildConfirmPayload,
} from '@/lib/menu-scan';
import { type DishCategory } from '@/lib/dish-categories';
import type { DietaryTagOption, RestaurantDetailsForm } from '../hooks/menuScanTypes';
import type { DishKind } from '@eatme/shared';

// ---------------------------------------------------------------------------
// Slice interface
// ---------------------------------------------------------------------------

export interface ReviewSlice {
  // State
  jobId: string;
  currency: string;
  editableMenus: EditableMenu[];
  dishCategories: DishCategory[];
  dietaryTags: DietaryTagOption[];
  expandedDishes: Set<string>;
  extractionNotes: ExtractionNote[];
  saving: boolean;
  savedCount: number;
  restaurantDetails: RestaurantDetailsForm;
  leftPanelTab: 'images' | 'details';
  lightboxOpen: boolean;

  // Simple setters
  setJobId: (jobId: string) => void;
  setCurrency: (currency: string) => void;
  setEditableMenus: (v: EditableMenu[] | ((prev: EditableMenu[]) => EditableMenu[])) => void;
  setDishCategories: (v: DishCategory[] | ((prev: DishCategory[]) => DishCategory[])) => void;
  setDietaryTags: (tags: DietaryTagOption[]) => void;
  setExpandedDishes: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setExtractionNotes: (notes: ExtractionNote[]) => void;
  setSaving: (saving: boolean) => void;
  setSavedCount: (count: number) => void;
  setRestaurantDetails: (details: RestaurantDetailsForm) => void;
  setLeftPanelTab: (tab: 'images' | 'details') => void;
  setLightboxOpen: (open: boolean) => void;

  // Compound actions
  updateRestaurantDetails: (patch: Partial<RestaurantDetailsForm>) => void;
  toggleExpand: (dishId: string) => void;

  // Menu/category/dish mutation actions
  updateMenu: (mIdx: number, patch: Partial<EditableMenu>) => void;
  updateCategory: (mIdx: number, cIdx: number, patch: { name?: string }) => void;
  updateDish: (mIdx: number, cIdx: number, dIdx: number, patch: Partial<EditableDish>) => void;
  deleteDish: (mIdx: number, cIdx: number, dIdx: number) => void;
  addDish: (mIdx: number, cIdx: number) => void;
  addVariantDish: (mIdx: number, cIdx: number, parentId: string) => void;
  deleteCategory: (mIdx: number, cIdx: number) => void;
  addCategory: (mIdx: number) => void;
  deleteMenu: (mIdx: number) => void;
  addMenu: () => void;
  updateDishById: (dishId: string, updates: Partial<EditableDish>) => void;

  // Save
  handleSave: (opts?: { onSaveSuccess?: () => void }) => Promise<void>;

  // Kind management
  setKind: (dishId: string, newKind: DishKind) => void;

  // Course actions
  addCourse: (dishId: string) => void;
  removeCourse: (dishId: string, courseIdx: number) => void;
  reorderCourses: (dishId: string, fromIdx: number, toIdx: number) => void;
  updateCourseField: (dishId: string, courseIdx: number, patch: Partial<EditableCourse>) => void;
  addCourseItem: (dishId: string, courseIdx: number) => void;
  removeCourseItem: (dishId: string, courseIdx: number, itemIdx: number) => void;
  reorderCourseItems: (dishId: string, courseIdx: number, fromIdx: number, toIdx: number) => void;
  updateCourseItem: (
    dishId: string,
    courseIdx: number,
    itemIdx: number,
    patch: Partial<EditableCourseItem>
  ) => void;

  // Hydration & reset
  hydrateFromJob: (enrichedResult: EnrichedResult, jobId: string, currency: string) => void;
  resetReview: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialRestaurantDetails: RestaurantDetailsForm = {
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
};

const initialState = {
  jobId: '',
  currency: 'USD',
  editableMenus: [] as EditableMenu[],
  dishCategories: [] as DishCategory[],
  dietaryTags: [] as DietaryTagOption[],
  expandedDishes: new Set<string>(),
  extractionNotes: [] as ExtractionNote[],
  saving: false,
  savedCount: 0,
  restaurantDetails: initialRestaurantDetails,
  leftPanelTab: 'images' as 'images' | 'details',
  lightboxOpen: false,
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function updateDishInMenus(
  editableMenus: EditableMenu[],
  dishId: string,
  updater: (dish: EditableDish) => EditableDish
): EditableMenu[] {
  return editableMenus.map(m => ({
    ...m,
    categories: m.categories.map(c => ({
      ...c,
      dishes: c.dishes.map(d => (d._id === dishId ? updater(d) : d)),
    })),
  }));
}

function moveElement<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createReviewSlice: StateCreator<any, [], [], ReviewSlice> = (set, get) => ({
  ...initialState,

  // --- Simple setters ---
  setJobId: jobId => set({ jobId }),
  setCurrency: currency => set({ currency }),
  setEditableMenus: v =>
    set((s: ReviewSlice) => ({
      editableMenus: typeof v === 'function' ? v(s.editableMenus) : v,
    })),
  setDishCategories: v =>
    set((s: ReviewSlice) => ({
      dishCategories: typeof v === 'function' ? v(s.dishCategories) : v,
    })),
  setDietaryTags: dietaryTags => set({ dietaryTags }),
  setExpandedDishes: v =>
    set((s: ReviewSlice) => ({
      expandedDishes: typeof v === 'function' ? v(s.expandedDishes) : v,
    })),
  setExtractionNotes: extractionNotes => set({ extractionNotes }),
  setSaving: saving => set({ saving }),
  setSavedCount: savedCount => set({ savedCount }),
  setRestaurantDetails: restaurantDetails => set({ restaurantDetails }),
  setLeftPanelTab: leftPanelTab => set({ leftPanelTab }),
  setLightboxOpen: lightboxOpen => set({ lightboxOpen }),

  // --- Compound setters ---
  updateRestaurantDetails: patch =>
    set((s: ReviewSlice) => ({
      restaurantDetails: { ...s.restaurantDetails, ...patch, dirty: true },
    })),

  toggleExpand: dishId =>
    set((s: ReviewSlice) => {
      const next = new Set(s.expandedDishes);
      if (next.has(dishId)) next.delete(dishId);
      else next.add(dishId);
      return { expandedDishes: next };
    }),

  // --- Menu/category/dish mutations ---
  updateMenu: (mIdx, patch) =>
    set((s: ReviewSlice) => ({
      editableMenus: s.editableMenus.map((m, i) => (i === mIdx ? { ...m, ...patch } : m)),
    })),

  updateCategory: (mIdx, cIdx, patch) =>
    set((s: ReviewSlice) => ({
      editableMenus: s.editableMenus.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => (ci === cIdx ? { ...c, ...patch } : c)),
        };
      }),
    })),

  updateDish: (mIdx, cIdx, dIdx, patch) =>
    set((s: ReviewSlice) => ({
      editableMenus: s.editableMenus.map((m, mi) => {
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
      }),
    })),

  deleteDish: (mIdx, cIdx, dIdx) =>
    set((s: ReviewSlice) => ({
      editableMenus: s.editableMenus.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            return { ...c, dishes: c.dishes.filter((_, di) => di !== dIdx) };
          }),
        };
      }),
    })),

  addDish: (mIdx, cIdx) => {
    const dish = newEmptyDish();
    set((s: ReviewSlice) => {
      const next = new Set(s.expandedDishes);
      next.add(dish._id);
      return {
        editableMenus: s.editableMenus.map((m, mi) => {
          if (mi !== mIdx) return m;
          return {
            ...m,
            categories: m.categories.map((c, ci) => {
              if (ci !== cIdx) return c;
              return { ...c, dishes: [...c.dishes, dish] };
            }),
          };
        }),
        expandedDishes: next,
      };
    });
  },

  addVariantDish: (mIdx, cIdx, parentId) => {
    const child: EditableDish = {
      ...newEmptyDish(),
      parent_id: parentId,
      is_parent: false,
      group_status: 'manual' as const,
    };
    set((s: ReviewSlice) => ({
      editableMenus: s.editableMenus.map((m, mi) => {
        if (mi !== mIdx) return m;
        return {
          ...m,
          categories: m.categories.map((c, ci) => {
            if (ci !== cIdx) return c;
            const updatedDishes = c.dishes.map(d =>
              d._id === parentId ? { ...d, variant_ids: [...d.variant_ids, child._id] } : d
            );
            return { ...c, dishes: [...updatedDishes, child] };
          }),
        };
      }),
    }));
  },

  deleteCategory: (mIdx, cIdx) =>
    set((s: ReviewSlice) => ({
      editableMenus: s.editableMenus.map((m, mi) => {
        if (mi !== mIdx) return m;
        return { ...m, categories: m.categories.filter((_, ci) => ci !== cIdx) };
      }),
    })),

  addCategory: mIdx =>
    set((s: ReviewSlice) => ({
      editableMenus: s.editableMenus.map((m, mi) => {
        if (mi !== mIdx) return m;
        return { ...m, categories: [...m.categories, { name: 'New Category', dishes: [] }] };
      }),
    })),

  deleteMenu: mIdx =>
    set((s: ReviewSlice) => ({
      editableMenus: s.editableMenus.filter((_, mi) => mi !== mIdx),
    })),

  addMenu: () =>
    set((s: ReviewSlice) => ({
      editableMenus: [...s.editableMenus, { name: 'New Menu', menu_type: 'food', categories: [] }],
    })),

  updateDishById: (dishId, updates) =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, d => ({ ...d, ...updates })),
    })),

  // --- Save ---
  handleSave: async (opts = {}) => {
    const state = get();
    const selectedRestaurant = (state as any).selectedRestaurant;
    const previewUrls: string[] = (state as any).previewUrls ?? [];
    const { jobId, editableMenus, restaurantDetails, saving } = state as ReviewSlice;

    if (saving) return;
    if (!selectedRestaurant || !jobId) return;

    const total = countDishes(editableMenus);
    if (total === 0) {
      toast.error('No dishes to save');
      return;
    }

    set({ saving: true });
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
          .eq('id', selectedRestaurant.id);
        if (patchErr) console.warn('[MenuScan] Restaurant patch failed:', patchErr.message);
      }

      const payload: ConfirmPayload = buildConfirmPayload(
        editableMenus,
        jobId,
        selectedRestaurant.id
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

      set({ savedCount: data.dishes_saved });
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      toast.success(
        `${data.dishes_saved} dishes saved to ${selectedRestaurant?.name ?? 'restaurant'}!`
      );
      opts.onSaveSuccess?.();
    } catch (err: unknown) {
      console.error('[MenuScan] Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      set({ saving: false });
    }
  },

  // --- Kind management ---
  setKind: (dishId, newKind) =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, dish => {
        const oldKind = dish.dish_kind;
        let patch: Partial<EditableDish> = { dish_kind: newKind };

        switch (newKind) {
          case 'standard':
            patch = { ...patch, is_parent: false, display_price_prefix: 'exact' };
            break;
          case 'bundle':
            patch = { ...patch, is_parent: true, display_price_prefix: 'exact' };
            break;
          case 'configurable':
            patch = { ...patch, is_parent: true, display_price_prefix: 'from' };
            break;
          case 'course_menu': {
            patch = { ...patch, is_parent: true, display_price_prefix: 'per_person' };
            const currentCourses = dish.courses ?? [];
            if (currentCourses.length === 0) {
              patch.courses = [newEmptyCourse(1)];
            }
            break;
          }
          case 'buffet':
            patch = { ...patch, is_parent: false, display_price_prefix: 'per_person' };
            break;
        }

        // Clear courses when switching away from course_menu
        if (oldKind === 'course_menu' && newKind !== 'course_menu') {
          patch.courses = [];
        }

        return { ...dish, ...patch };
      }),
    })),

  // --- Course actions ---
  addCourse: dishId =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, dish => {
        const courses = dish.courses ?? [];
        return { ...dish, courses: [...courses, newEmptyCourse(courses.length + 1)] };
      }),
    })),

  removeCourse: (dishId, courseIdx) =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, dish => {
        const courses = (dish.courses ?? []).filter((_, i) => i !== courseIdx);
        // Renumber
        const renumbered = courses.map((c, i) => ({ ...c, course_number: i + 1 }));
        return { ...dish, courses: renumbered };
      }),
    })),

  reorderCourses: (dishId, fromIdx, toIdx) =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, dish => {
        const reordered = moveElement(dish.courses ?? [], fromIdx, toIdx);
        const renumbered = reordered.map((c, i) => ({ ...c, course_number: i + 1 }));
        return { ...dish, courses: renumbered };
      }),
    })),

  updateCourseField: (dishId, courseIdx, patch) =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, dish => {
        const courses = (dish.courses ?? []).map((c, i) =>
          i === courseIdx ? { ...c, ...patch } : c
        );
        return { ...dish, courses };
      }),
    })),

  addCourseItem: (dishId, courseIdx) =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, dish => {
        const courses = (dish.courses ?? []).map((c, i) => {
          if (i !== courseIdx) return c;
          return { ...c, items: [...c.items, newEmptyCourseItem()] };
        });
        return { ...dish, courses };
      }),
    })),

  removeCourseItem: (dishId, courseIdx, itemIdx) =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, dish => {
        const courses = (dish.courses ?? []).map((c, i) => {
          if (i !== courseIdx) return c;
          return { ...c, items: c.items.filter((_, ii) => ii !== itemIdx) };
        });
        return { ...dish, courses };
      }),
    })),

  reorderCourseItems: (dishId, courseIdx, fromIdx, toIdx) =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, dish => {
        const courses = (dish.courses ?? []).map((c, i) => {
          if (i !== courseIdx) return c;
          return { ...c, items: moveElement(c.items, fromIdx, toIdx) };
        });
        return { ...dish, courses };
      }),
    })),

  updateCourseItem: (dishId, courseIdx, itemIdx, patch) =>
    set((s: ReviewSlice) => ({
      editableMenus: updateDishInMenus(s.editableMenus, dishId, dish => {
        const courses = (dish.courses ?? []).map((c, i) => {
          if (i !== courseIdx) return c;
          return {
            ...c,
            items: c.items.map((item, ii) => (ii === itemIdx ? { ...item, ...patch } : item)),
          };
        });
        return { ...dish, courses };
      }),
    })),

  // --- Hydration ---
  hydrateFromJob: (enrichedResult, jobId, currency) => {
    const menus = toEditableMenus(enrichedResult);

    // Normalize legacy kinds across all dishes
    const normalized = menus.map(m => ({
      ...m,
      categories: m.categories.map(c => ({
        ...c,
        dishes: c.dishes.map(d => {
          const kind = d.dish_kind as string;
          if (kind === 'combo') {
            return { ...d, dish_kind: 'bundle' as DishKind };
          }
          if (kind === 'template') {
            return { ...d, dish_kind: 'configurable' as DishKind, is_template: true };
          }
          if (kind === 'experience') {
            return { ...d, dish_kind: 'configurable' as DishKind };
          }
          return d;
        }),
      })),
    }));

    set({ editableMenus: normalized, jobId, currency });
  },

  // --- Reset ---
  resetReview: () => set({ ...initialState, expandedDishes: new Set<string>() }),
});
