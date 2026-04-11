'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  type EditableMenu,
  type EditableDish,
  type EditableIngredient,
  type EnrichedResult,
  type ConfirmPayload,
  type FlaggedDuplicate,
  toEditableMenus,
  newEmptyDish,
  countDishes,
  buildConfirmPayload,
} from '@/lib/menu-scan';
import { fetchDishCategories, type DishCategory } from '@/lib/dish-categories';
import type { BatchFilters } from '@/components/admin/menu-scan/BatchToolbar';
import { formatLocationForSupabase } from '@/lib/supabase';
import { resizeImageToBase64, pdfToImages } from '@/lib/menu-scan-utils';

// ---------------------------------------------------------------------------
// Types (exported so page and step components can import them)
// ---------------------------------------------------------------------------

export type Step = 'upload' | 'processing' | 'review' | 'done';

export interface RestaurantOption {
  id: string;
  name: string;
  city: string | null;
  country_code: string | null;
}

export interface DietaryTagOption {
  id: string;
  code: string;
  name: string;
}

export interface AddIngredientTarget {
  menuIdx: number;
  catIdx: number;
  dishIdx: number;
  rawText: string;
}

export interface RestaurantDetailsForm {
  address: string;
  city: string;
  neighbourhood: string;
  state: string;
  postal_code: string;
  country_code: string;
  phone: string;
  website: string;
  lat: number | null;
  lng: number | null;
  dirty: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMenuScanState() {
  // ---------- step state ----------
  const [step, setStep] = useState<Step>('upload');

  // ---------- query param pre-selection ----------
  const searchParams = useSearchParams();

  // ---------- upload step ----------
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [showRestaurantDropdown, setShowRestaurantDropdown] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantOption | null>(null);
  const [isPreSelected, setIsPreSelected] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPdfConverting, setIsPdfConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- processing step ----------
  const [processingError, setProcessingError] = useState('');
  const [processingStage, setProcessingStage] = useState<'resizing' | 'sending' | 'analyzing'>(
    'resizing'
  );

  // ---------- review step ----------
  const [jobId, setJobId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [editableMenus, setEditableMenus] = useState<EditableMenu[]>([]);
  const [dishCategories, setDishCategories] = useState<DishCategory[]>([]);
  const [dietaryTags, setDietaryTags] = useState<DietaryTagOption[]>([]);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [expandedDishes, setExpandedDishes] = useState<Set<string>>(new Set());
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
  const [saving, setSaving] = useState(false);

  // ---------- flagged duplicates from merge ----------
  const [flaggedDuplicates, setFlaggedDuplicates] = useState<FlaggedDuplicate[]>([]);

  // ---------- batch toolbar / group review state ----------
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [batchFilters, setBatchFilters] = useState<BatchFilters>({
    confidenceMin: null,
    dishKind: null,
    hasGrouping: null,
  });
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);

  // ---------- quick-add restaurant ----------
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState('');

  // ---------- done step ----------
  const [savedCount, setSavedCount] = useState(0);

  // ---------- restaurant details (filled during processing / editable in review) ----------
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

  // ---------- review left-panel tab ----------
  const [leftPanelTab, setLeftPanelTab] = useState<'images' | 'details'>('images');

  // ---------- image zoom lightbox ----------
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // ---------- load supporting data on mount ----------
  useEffect(() => {
    supabase
      .from('restaurants')
      .select('id, name, city, country_code')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('[MenuScan] Failed to load restaurants:', error.message);
        setRestaurants((data as RestaurantOption[]) ?? []);
      });

    fetchDishCategories().then(({ data }) => setDishCategories(data));

    supabase
      .from('dietary_tags')
      .select('id, code, name')
      .order('name')
      .then(({ data }) => setDietaryTags((data as DietaryTagOption[]) ?? []));
  }, []);

  // ---------- query-param restaurant pre-selection ----------
  useEffect(() => {
    const restaurantId = searchParams.get('restaurant_id');
    if (!restaurantId) return;

    supabase
      .from('restaurants')
      .select('id, name, city, country_code')
      .eq('id', restaurantId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.warning('Restaurant not found — please select one from the list');
          return;
        }
        const r = data as RestaurantOption;
        setSelectedRestaurant(r);
        setRestaurantSearch(r.name);
        setIsPreSelected(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ---------- filtered restaurant list ----------
  const filteredRestaurants = restaurantSearch.trim()
    ? restaurants.filter(r => r.name.toLowerCase().includes(restaurantSearch.toLowerCase()))
    : restaurants;

  // ---------- file selection helpers ----------
  const handleFilesSelected = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      const images = arr.filter(f => f.type.startsWith('image/'));
      const pdfs = arr.filter(f => f.type === 'application/pdf');

      let allNew: File[] = [...images];

      if (pdfs.length > 0) {
        setIsPdfConverting(true);
        try {
          const pages = (await Promise.all(pdfs.map(f => pdfToImages(f)))).flat();
          allNew = [...allNew, ...pages];
          if (pages.length > 0) {
            toast.success(
              `Converted ${pdfs.length} PDF(s) → ${pages.length} page${pages.length !== 1 ? 's' : ''}`
            );
          }
        } catch (err) {
          console.error('[MenuScan] PDF conversion failed:', err);
          toast.error('Failed to read PDF — try saving pages as images instead');
        } finally {
          setIsPdfConverting(false);
        }
      }

      const combined = [...imageFiles, ...allNew].slice(0, 20);
      setImageFiles(combined);

      setPreviewUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url));
        return combined.map(f => URL.createObjectURL(f));
      });
    },
    [imageFiles]
  );

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previewUrls[idx]);
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => prev.filter((_, i) => i !== idx));
    if (currentImageIdx >= imageFiles.length - 1) {
      setCurrentImageIdx(Math.max(0, imageFiles.length - 2));
    }
  };

  // ---------- drag & drop handlers ----------
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const arr = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (arr.length) handleFilesSelected(arr);
  };

  // ---------- process handler: call /api/menu-scan ----------
  const handleProcess = async () => {
    if (!selectedRestaurant) {
      toast.error('Please select a restaurant');
      return;
    }
    if (imageFiles.length === 0) {
      toast.error('Please upload at least one image or PDF');
      return;
    }
    if (isPdfConverting) {
      toast.error('PDF is still converting — please wait a moment');
      return;
    }

    setProcessingError('');
    setRestaurantDetails({
      address: '',
      city: selectedRestaurant.city || '',
      neighbourhood: '',
      state: '',
      postal_code: '',
      country_code: selectedRestaurant.country_code || 'MX',
      phone: '',
      website: '',
      lat: null,
      lng: null,
      dirty: false,
    });
    setLeftPanelTab('images');
    setStep('processing');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired — please reload');

      setProcessingStage('resizing');
      toast.info('Resizing images...');
      const resized = await Promise.all(imageFiles.map(f => resizeImageToBase64(f)));

      setProcessingStage('sending');
      toast.info(`Sending ${resized.length} image(s) to AI...`);
      setProcessingStage('analyzing');
      const response = await fetch('/api/menu-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          restaurant_id: selectedRestaurant.id,
          images: resized,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'AI processing failed');

      const enriched: EnrichedResult = data.result;
      const menus = toEditableMenus(enriched);

      const autoExpanded = new Set<string>();
      menus.forEach(menu =>
        menu.categories.forEach(cat =>
          cat.dishes.forEach(dish => {
            if (dish.confidence < 0.7) autoExpanded.add(dish._id);
          })
        )
      );

      setJobId(data.jobId);
      setCurrency(data.currency ?? 'USD');
      setEditableMenus(menus);
      setExpandedDishes(autoExpanded);
      setFlaggedDuplicates(data.flaggedDuplicates ?? []);
      setCurrentImageIdx(0);
      setStep('review');
      toast.success(`Extracted ${data.dishCount} dishes — please review`);
    } catch (err: unknown) {
      console.error('[MenuScan] Processing error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setProcessingError(msg);
      setStep('upload');
      toast.error(msg);
    }
  };

  // ---------- save handler: call /api/menu-scan/confirm ----------
  const handleSave = async () => {
    if (!selectedRestaurant || !jobId) return;

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
          .eq('id', selectedRestaurant.id);
        if (patchErr) console.warn('[MenuScan] Restaurant patch failed:', patchErr.message);
        else console.log('[MenuScan] Restaurant details updated');
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

      setSavedCount(data.dishes_saved);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setStep('done');
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

  // ---------- group management helpers ----------

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

  const acceptGroup = (parentId: string) => {
    setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d._id === parentId || d.parent_id === parentId) {
              return { ...d, group_status: 'accepted' as const };
            }
            return d;
          }),
        })),
      }))
    );
    toast.success('Group accepted');
  };

  const rejectGroup = (parentId: string) => {
    setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d._id === parentId || d.parent_id === parentId) {
              return { ...d, group_status: 'rejected' as const };
            }
            return d;
          }),
        })),
      }))
    );
    toast('Group rejected', { icon: '✕' });
  };

  const ungroupChild = (childId: string) => {
    setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d._id === childId) {
              return { ...d, parent_id: null, is_parent: false, group_status: 'manual' as const };
            }
            if (d.variant_ids.includes(childId)) {
              const newVariantIds = d.variant_ids.filter(id => id !== childId);
              return {
                ...d,
                variant_ids: newVariantIds,
                is_parent: newVariantIds.length > 0,
              };
            }
            return d;
          }),
        })),
      }))
    );
    toast('Variant ungrouped');
  };

  const groupFlaggedDuplicate = (dupIndex: number) => {
    const dup = flaggedDuplicates[dupIndex];
    if (!dup) return;

    setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d.name.toLowerCase().trim() === dup.existingDish.name.toLowerCase().trim()) {
              if (d.price === String(dup.existingDish.price)) {
                return {
                  ...d,
                  is_parent: true,
                  dish_kind: 'standard' as const,
                  display_price_prefix: 'from' as const,
                  group_status: 'manual' as const,
                };
              }
            }
            return d;
          }),
        })),
      }))
    );
    setFlaggedDuplicates(prev => prev.filter((_, i) => i !== dupIndex));
    toast.success('Dishes grouped as variants');
  };

  const dismissFlaggedDuplicate = (dupIndex: number) => {
    setFlaggedDuplicates(prev => prev.filter((_, i) => i !== dupIndex));
  };

  const getParentGroups = useCallback((): Array<{
    parent: EditableDish;
    children: EditableDish[];
    menuIdx: number;
    catIdx: number;
  }> => {
    const groups: Array<{
      parent: EditableDish;
      children: EditableDish[];
      menuIdx: number;
      catIdx: number;
    }> = [];

    editableMenus.forEach((menu, mIdx) => {
      menu.categories.forEach((cat, cIdx) => {
        cat.dishes.forEach(dish => {
          if (dish.is_parent) {
            const children = cat.dishes.filter(d => d.parent_id === dish._id);
            groups.push({ parent: dish, children, menuIdx: mIdx, catIdx: cIdx });
          }
        });
      });
    });

    return groups;
  }, [editableMenus]);

  const acceptHighConfidence = (threshold: number) => {
    let count = 0;
    setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d.is_parent && d.confidence >= threshold && d.group_status === 'ai_proposed') {
              count++;
              return { ...d, group_status: 'accepted' as const };
            }
            if (d.parent_id) {
              const parent = c.dishes.find(p => p._id === d.parent_id);
              if (parent && parent.confidence >= threshold && parent.group_status === 'ai_proposed') {
                return { ...d, group_status: 'accepted' as const };
              }
            }
            return d;
          }),
        })),
      }))
    );
    if (count > 0) toast.success(`Accepted ${count} high-confidence group(s)`);
    else toast.info('No unreviewed high-confidence groups found');
  };

  const acceptSelected = () => {
    setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (selectedGroupIds.has(d._id) || (d.parent_id && selectedGroupIds.has(d.parent_id))) {
              return { ...d, group_status: 'accepted' as const };
            }
            return d;
          }),
        })),
      }))
    );
    toast.success(`Accepted ${selectedGroupIds.size} group(s)`);
    setSelectedGroupIds(new Set());
  };

  const rejectSelected = () => {
    setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (selectedGroupIds.has(d._id) || (d.parent_id && selectedGroupIds.has(d.parent_id))) {
              return { ...d, group_status: 'rejected' as const };
            }
            return d;
          }),
        })),
      }))
    );
    toast('Rejected selected groups', { icon: '✕' });
    setSelectedGroupIds(new Set());
  };

  // ---------- derived counts ----------
  const reviewedGroupCount = editableMenus.reduce(
    (total, menu) =>
      total +
      menu.categories.reduce(
        (sum, cat) =>
          sum +
          cat.dishes.filter(
            d => d.is_parent && (d.group_status === 'accepted' || d.group_status === 'rejected')
          ).length,
        0
      ),
    0
  );

  const totalGroupCount = editableMenus.reduce(
    (total, menu) =>
      total +
      menu.categories.reduce(
        (sum, cat) => sum + cat.dishes.filter(d => d.is_parent).length,
        0
      ),
    0
  );

  // ---------- keyboard shortcuts for group review (A/R/E) ----------
  useEffect(() => {
    if (step !== 'review' || !focusedGroupId) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        acceptGroup(focusedGroupId);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        rejectGroup(focusedGroupId);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        toggleExpand(focusedGroupId);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, focusedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- reset all state ----------
  const resetAll = () => {
    setStep('upload');
    setSelectedRestaurant(null);
    setRestaurantSearch('');
    setImageFiles([]);
    setPreviewUrls([]);
    setJobId('');
    setEditableMenus([]);
    setExpandedDishes(new Set());
    setSelectedGroupIds(new Set());
    setFocusedGroupId(null);
    setBatchFilters({ confidenceMin: null, dishKind: null, hasGrouping: null });
    setSavedCount(0);
    setProcessingError('');
    setRestaurantDetails({
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
    setLightboxOpen(false);
    setLeftPanelTab('images');
  };

  return {
    // Step
    step,
    setStep,

    // Upload
    restaurants,
    setRestaurants,
    restaurantSearch,
    setRestaurantSearch,
    showRestaurantDropdown,
    setShowRestaurantDropdown,
    selectedRestaurant,
    setSelectedRestaurant,
    isPreSelected,
    setIsPreSelected,
    imageFiles,
    setImageFiles,
    previewUrls,
    setPreviewUrls,
    isDragging,
    isPdfConverting,
    fileInputRef,
    filteredRestaurants,
    handleFilesSelected,
    removeImage,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleProcess,
    showQuickAdd,
    setShowQuickAdd,
    quickAddInitialName,
    setQuickAddInitialName,

    // Processing
    processingError,
    processingStage,

    // Review
    jobId,
    currency,
    setCurrency,
    editableMenus,
    setEditableMenus,
    dishCategories,
    setDishCategories,
    dietaryTags,
    currentImageIdx,
    setCurrentImageIdx,
    expandedDishes,
    addIngredientTarget,
    setAddIngredientTarget,
    suggestingDishId,
    isSuggestingAll,
    suggestAllProgress,
    inlineSearchTarget,
    setInlineSearchTarget,
    subIngredientEditTarget,
    setSubIngredientEditTarget,
    saving,

    // Flagged duplicates
    flaggedDuplicates,

    // Batch
    selectedGroupIds,
    setSelectedGroupIds,
    batchFilters,
    setBatchFilters,
    focusedGroupId,
    setFocusedGroupId,

    // Done
    savedCount,

    // Restaurant details
    restaurantDetails,
    updateRestaurantDetails,

    // UI
    leftPanelTab,
    setLeftPanelTab,
    lightboxOpen,
    setLightboxOpen,

    // Actions
    handleSave,
    updateMenu,
    updateCategory,
    updateDish,
    resolveIngredient,
    addIngredientToDish,
    removeIngredientFromDish,
    addSubIngredient,
    removeSubIngredient,
    suggestIngredients,
    suggestAllDishes,
    deleteDish,
    addDish,
    deleteCategory,
    addCategory,
    deleteMenu,
    addMenu,
    toggleExpand,
    updateDishById,
    acceptGroup,
    rejectGroup,
    ungroupChild,
    groupFlaggedDuplicate,
    dismissFlaggedDuplicate,
    getParentGroups,
    acceptHighConfidence,
    acceptSelected,
    rejectSelected,
    reviewedGroupCount,
    totalGroupCount,
    resetAll,

    // Convenience aliases for the design-doc interface (Step 17 orchestrator)
    uploadedFiles: imageFiles,
    selectedDishes: selectedGroupIds,
  };
}
