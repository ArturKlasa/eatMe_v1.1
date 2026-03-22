'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  X,
  Utensils,
  Store,
  ZoomIn,
  MapPin,
  Sparkles,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getDietaryTagIcon, getAllergenIcon } from '@/lib/icons';
import { AddIngredientPanel } from '@/components/admin/AddIngredientPanel';
import { InlineIngredientSearch } from '@/components/admin/InlineIngredientSearch';
import { NewRestaurantForm, type NewRestaurantResult } from '@/components/admin/NewRestaurantForm';
import {
  type EditableMenu,
  type EditableDish,
  type EditableIngredient,
  type EnrichedResult,
  type ConfirmPayload,
  toEditableMenus,
  newEmptyDish,
  countDishes,
} from '@/lib/menu-scan';
import { fetchDishCategories, createDishCategory, type DishCategory } from '@/lib/dish-categories';
import dynamic from 'next/dynamic';
import { formatLocationForSupabase } from '@/lib/supabase';

const LocationPickerComponent = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-48 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-sm text-gray-400">
      Loading map…
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'upload' | 'processing' | 'review' | 'done';

interface RestaurantOption {
  id: string;
  name: string;
  city: string | null;
  country_code: string | null;
}

interface DietaryTagOption {
  id: string;
  code: string;
  name: string;
}

interface AddIngredientTarget {
  menuIdx: number;
  catIdx: number;
  dishIdx: number;
  rawText: string;
}

interface RestaurantDetailsForm {
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
// Image resizing (runs in browser before sending to API)
// Reduces large phone photos to ≤1500px keeping ratio, ~80% JPEG quality
// ---------------------------------------------------------------------------

async function resizeImageToBase64(
  file: File,
  maxDim = 1500
): Promise<{ name: string; mime_type: string; data: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      resolve({
        name: file.name.replace(/\.[^.]+$/, '.jpg'),
        mime_type: 'image/jpeg',
        data: dataUrl.split(',')[1],
      });
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
    img.src = objectUrl;
  });
}

// ---------------------------------------------------------------------------
// PDF → images (runs in browser using pdfjs-dist, no server needed)
// Renders each page to a canvas at 2× scale, exports as JPEG File.
// ---------------------------------------------------------------------------

async function pdfToImages(file: File, maxPagesPerFile = 20): Promise<File[]> {
  const pdfjsLib = await import('pdfjs-dist');
  // Worker is committed to /public — re-copy from node_modules if pdfjs-dist is upgraded
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = Math.min(pdf.numPages, maxPagesPerFile);
  const baseName = file.name.replace(/\.pdf$/i, '');
  const results: File[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // ~1680 px for an A4 page
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    await page.render({
      canvasContext: ctx as Parameters<typeof page.render>[0]['canvasContext'],
      viewport,
    }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85)
    );
    results.push(new File([blob], `${baseName}_p${pageNum}.jpg`, { type: 'image/jpeg' }));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Build the confirm payload from editable state
// ---------------------------------------------------------------------------

function buildConfirmPayload(
  jobId: string,
  restaurantId: string,
  editableMenus: EditableMenu[]
): ConfirmPayload {
  return {
    job_id: jobId,
    restaurant_id: restaurantId,
    menus: editableMenus
      .map(menu => ({
        name: menu.name.trim() || 'Menu',
        menu_type: menu.menu_type,
        categories: menu.categories
          .map(cat => ({
            name: cat.name.trim() || 'General',
            dishes: cat.dishes
              .filter(d => d.name.trim().length > 0)
              .map(d => {
                // Collect all matched ingredient IDs (including sub-ingredients for allergens)
                const ingredientIds = d.ingredients.flatMap(ing => {
                  if (ing.status !== 'matched' || !ing.canonical_ingredient_id) return [];
                  const ids = [ing.canonical_ingredient_id];
                  for (const sub of ing.sub_ingredients ?? []) {
                    if (sub.status === 'matched' && sub.canonical_ingredient_id) {
                      ids.push(sub.canonical_ingredient_id);
                    }
                  }
                  return ids;
                });
                // Build option groups from ingredients with sub-ingredients
                const optionGroups = d.ingredients
                  .filter(ing => ing.status === 'matched' && (ing.sub_ingredients?.length ?? 0) > 0)
                  .map(ing => ({
                    name: `Choice of ${ing.display_name || ing.raw_text}`,
                    selection_type: 'single' as const,
                    options: (ing.sub_ingredients ?? [])
                      .filter(s => s.status === 'matched')
                      .map(s => ({
                        name: s.display_name || s.raw_text,
                        canonical_ingredient_id: s.canonical_ingredient_id,
                      })),
                  }))
                  .filter(og => og.options.length > 0);
                return {
                  name: d.name.trim(),
                  price: parseFloat(d.price) || 0,
                  description: d.description.trim() || undefined,
                  dietary_tags: d.dietary_tags,
                  spice_level: d.spice_level,
                  calories: d.calories,
                  dish_category_id: d.dish_category_id,
                  canonical_ingredient_ids: ingredientIds,
                  ...(optionGroups.length > 0 ? { option_groups: optionGroups } : {}),
                };
              }),
          }))
          .filter(cat => cat.dishes.length > 0),
      }))
      .filter(menu => menu.categories.length > 0),
  };
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.85
      ? 'bg-green-100 text-green-700'
      : confidence >= 0.6
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  return <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', color)}>{pct}%</span>;
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function MenuScanPage() {
  // ---------- step state ----------
  const [step, setStep] = useState<Step>('upload');

  // ---------- upload step ----------
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [showRestaurantDropdown, setShowRestaurantDropdown] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantOption | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPdfConverting, setIsPdfConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- processing step ----------
  const [processingError, setProcessingError] = useState('');

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
    // Load restaurants for selector
    supabase
      .from('restaurants')
      .select('id, name, city, country_code')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('[MenuScan] Failed to load restaurants:', error.message);
        setRestaurants((data as RestaurantOption[]) ?? []);
      });

    // Load dish categories for review
    fetchDishCategories().then(({ data }) => setDishCategories(data));

    // Load dietary tags for review
    supabase
      .from('dietary_tags')
      .select('id, code, name')
      .order('name')
      .then(({ data }) => setDietaryTags((data as DietaryTagOption[]) ?? []));
  }, []);

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

      const combined = [...imageFiles, ...allNew].slice(0, 20); // max 20 images/pages
      setImageFiles(combined);

      // Revoke old URLs & create new ones
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
    // Pre-fill details from the selected restaurant so user can refine during processing
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

      // Resize images client-side
      toast.info('Resizing images...');
      const resized = await Promise.all(imageFiles.map(f => resizeImageToBase64(f)));

      toast.info(`Sending ${resized.length} image(s) to AI...`);
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

      // Auto-expand low-confidence dishes
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

      // 1. PATCH restaurant details if the user filled them in
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
        jobId,
        selectedRestaurant.id,
        editableMenus
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
      // Revoke preview URLs
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
    ing: import('@/lib/menu-scan').EditableIngredient
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
                // Avoid duplicates
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
    // Clear/adjust sub-ingredient editor if it targets this ingredient or one after it
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
    sub: import('@/lib/menu-scan').EditableIngredient
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

      const suggestions: import('@/lib/menu-scan').EditableIngredient[] = data.ingredients ?? [];
      // Fix: vegan implies vegetarian
      const rawTags: string[] = data.dietary_tags ?? [];
      const effectiveDietaryTags =
        rawTags.includes('vegan') && !rawTags.includes('vegetarian')
          ? [...rawTags, 'vegetarian']
          : rawTags;
      const suggestedAllergens: string[] = data.allergens ?? [];
      const suggestedSpice: 'none' | 'mild' | 'hot' | null = data.spice_level ?? null;
      const suggestedCategoryId: string | null = data.dish_category_id ?? null;
      const suggestedCategoryName: string | null = data.dish_category_name ?? null;

      // If AI created a new category, refresh the local list
      if (suggestedCategoryId && !dishCategories.some(dc => dc.id === suggestedCategoryId)) {
        fetchDishCategories().then(({ data: freshCats }) => setDishCategories(freshCats));
      }

      // Compute toast summary from snapshot BEFORE setState (accurate for single-user admin)
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

      // Fix: dedup inside updater uses `prev` state, not stale closure
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

                  const patch: Partial<import('@/lib/menu-scan').EditableDish> = {};

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

    // Collect all food dish coordinates
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

            const suggestions: import('@/lib/menu-scan').EditableIngredient[] =
              data.ingredients ?? [];
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
                        const patch: Partial<import('@/lib/menu-scan').EditableDish> = {};
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

    // Refresh dish categories if AI created new ones
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

  const resetAll = () => {
    setStep('upload');
    setSelectedRestaurant(null);
    setRestaurantSearch('');
    setImageFiles([]);
    setPreviewUrls([]);
    setJobId('');
    setEditableMenus([]);
    setExpandedDishes(new Set());
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

  // ====================================================================
  // RENDER: Upload step
  // ====================================================================

  if (step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ScanLine className="h-8 w-8 text-orange-600" />
            Menu Scan
          </h1>
          <p className="mt-2 text-gray-600">
            Upload photos of a restaurant menu — AI extracts the dishes for you to review.
          </p>
        </div>

        {processingError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Processing failed</p>
              <p className="mt-0.5">{processingError}</p>
            </div>
          </div>
        )}

        {/* Restaurant selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">1. Select Restaurant</h2>
            <button
              onClick={() => {
                setQuickAddInitialName(restaurantSearch);
                setShowQuickAdd(v => !v);
              }}
              className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              <Store className="h-4 w-4" />
              New Restaurant
            </button>
          </div>

          {/* Quick-add restaurant inline form */}
          {showQuickAdd && (
            <div className="max-h-[75vh] overflow-y-auto pr-1">
              <NewRestaurantForm
                compact
                initialName={quickAddInitialName}
                onSave={(created: NewRestaurantResult) => {
                  const r: RestaurantOption = {
                    id: created.id,
                    name: created.name,
                    city: created.city,
                    country_code: created.country_code,
                  };
                  setRestaurants(prev => [...prev, r].sort((a, b) => a.name.localeCompare(b.name)));
                  setSelectedRestaurant(r);
                  setRestaurantSearch(r.name);
                  setShowQuickAdd(false);
                  setShowRestaurantDropdown(false);
                }}
                onCancel={() => setShowQuickAdd(false)}
              />
            </div>
          )}

          {!showQuickAdd && (
            <div className="relative">
              <Input
                value={restaurantSearch}
                onChange={e => {
                  setRestaurantSearch(e.target.value);
                  setSelectedRestaurant(null);
                  setShowRestaurantDropdown(true);
                }}
                onFocus={() => setShowRestaurantDropdown(true)}
                placeholder="Search restaurant by name..."
                className="w-full"
              />
              {selectedRestaurant && (
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              )}
              {showRestaurantDropdown && restaurantSearch.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {filteredRestaurants.length === 0 ? (
                    <button
                      className="w-full text-left px-4 py-3 text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                      onClick={() => {
                        setQuickAddInitialName(restaurantSearch);
                        setShowQuickAdd(true);
                        setShowRestaurantDropdown(false);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Create &ldquo;{restaurantSearch}&rdquo; as new restaurant
                    </button>
                  ) : (
                    filteredRestaurants.slice(0, 20).map(r => (
                      <button
                        key={r.id}
                        className="w-full text-left px-4 py-2.5 hover:bg-orange-50 text-sm border-b border-gray-100 last:border-0"
                        onClick={() => {
                          setSelectedRestaurant(r);
                          setRestaurantSearch(r.name);
                          setShowRestaurantDropdown(false);
                        }}
                      >
                        <span className="font-medium">{r.name}</span>
                        {r.city && <span className="text-gray-400 ml-2">— {r.city}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {selectedRestaurant && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {selectedRestaurant.name}
              {selectedRestaurant.country_code && ` — ${selectedRestaurant.country_code}`}
            </p>
          )}
        </div>

        {/* Image upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">
            2. Upload Menu Photos or PDF (max 20 pages)
          </h2>

          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-orange-400 bg-orange-50'
                : 'border-gray-300 hover:border-orange-300 hover:bg-orange-50/50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isPdfConverting && fileInputRef.current?.click()}
          >
            {isPdfConverting ? (
              <>
                <Loader2 className="h-10 w-10 mx-auto text-orange-400 mb-3 animate-spin" />
                <p className="text-sm font-medium text-gray-700">Converting PDF pages…</p>
                <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  Drag & drop photos or a PDF here, or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPG, PNG, WEBP or PDF — up to 20 images/pages. Phone photos work fine.
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={e => e.target.files && handleFilesSelected(e.target.files)}
            />
          </div>

          {/* Thumbnails */}
          {previewUrls.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {previewUrls.map((url, idx) => (
                <div key={idx} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Image ${idx + 1}`}
                    className="h-20 w-20 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      removeImage(idx);
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 right-1 text-[10px] bg-black/50 text-white px-1 rounded">
                    {idx + 1}
                  </span>
                </div>
              ))}
              {imageFiles.length < 10 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors"
                >
                  <Plus className="h-6 w-6" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            onClick={handleProcess}
            disabled={!selectedRestaurant || imageFiles.length === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 text-base"
            size="lg"
          >
            <ScanLine className="h-5 w-5" />
            Extract with AI
          </Button>
        </div>
      </div>
    );
  }

  // ====================================================================
  // RENDER: Processing step — split layout so user can fill details while AI works
  // ====================================================================

  if (step === 'processing') {
    return (
      <div className="flex gap-8 min-h-[70vh]">
        {/* Left: AI progress */}
        <div className="w-72 shrink-0 flex flex-col items-center justify-center text-center space-y-5">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-orange-100 border-t-orange-600 animate-spin" />
            <ScanLine className="absolute inset-0 m-auto h-8 w-8 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Extracting menu…</h2>
            <p className="text-sm text-gray-500 mt-1">
              {imageFiles.length} image{imageFiles.length > 1 ? 's' : ''} · GPT-4o Vision
            </p>
            {selectedRestaurant && (
              <p className="text-sm text-orange-600 mt-1 font-medium">{selectedRestaurant.name}</p>
            )}
          </div>
          <p className="text-xs text-gray-400">10–30 seconds. Use the time to fill in details →</p>
        </div>

        {/* Right: restaurant details form */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-orange-600" />
              <h2 className="font-semibold text-gray-800">Restaurant Details</h2>
              <span className="text-xs text-gray-400">(optional — saved with the menu)</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-600 mb-1 block">Address</label>
                <Input
                  value={restaurantDetails.address}
                  onChange={e => updateRestaurantDetails({ address: e.target.value })}
                  placeholder="e.g. Av. Chapultepec 123"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">City</label>
                <Input
                  value={restaurantDetails.city}
                  onChange={e => updateRestaurantDetails({ city: e.target.value })}
                  placeholder="e.g. Guadalajara"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Postal Code</label>
                <Input
                  value={restaurantDetails.postal_code}
                  onChange={e => updateRestaurantDetails({ postal_code: e.target.value })}
                  placeholder="e.g. 44100"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600 mb-1 block">Neighbourhood</label>
                <Input
                  value={restaurantDetails.neighbourhood}
                  onChange={e => updateRestaurantDetails({ neighbourhood: e.target.value })}
                  placeholder="e.g. Zona Rosa"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Country</label>
                <select
                  value={restaurantDetails.country_code}
                  onChange={e => updateRestaurantDetails({ country_code: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-400"
                >
                  <option value="MX">🇲🇽 Mexico</option>
                  <option value="US">🇺🇸 United States</option>
                  <option value="ES">🇪🇸 Spain</option>
                  <option value="AR">🇦🇷 Argentina</option>
                  <option value="CO">🇨🇴 Colombia</option>
                  <option value="CL">🇨🇱 Chile</option>
                  <option value="PE">🇵🇪 Peru</option>
                  <option value="PL">🇵🇱 Poland</option>
                  <option value="GB">🇬🇧 UK</option>
                  <option value="DE">🇩🇪 Germany</option>
                  <option value="CA">🇨🇦 Canada</option>
                  <option value="AU">🇦🇺 Australia</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Phone</label>
                <Input
                  value={restaurantDetails.phone}
                  onChange={e => updateRestaurantDetails({ phone: e.target.value })}
                  placeholder="+52 33 1234 5678"
                  type="tel"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Website</label>
                <Input
                  value={restaurantDetails.website}
                  onChange={e => updateRestaurantDetails({ website: e.target.value })}
                  placeholder="https://"
                  type="url"
                />
              </div>
            </div>

            {/* Map */}
            <div>
              <label className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Pin Location on Map
                {restaurantDetails.lat && (
                  <span className="text-green-600 ml-1">
                    ✓ {restaurantDetails.lat.toFixed(5)}, {restaurantDetails.lng?.toFixed(5)}
                  </span>
                )}
              </label>
              <LocationPickerComponent
                onLocationSelect={(lat, lng) => updateRestaurantDetails({ lat, lng })}
                onAddressSelect={addr => {
                  updateRestaurantDetails({ address: addr });
                }}
                onLocationDetails={details => {
                  const patch: Partial<RestaurantDetailsForm> = {};
                  if (details.city) patch.city = details.city;
                  if (details.neighbourhood) patch.neighbourhood = details.neighbourhood;
                  if (details.state) patch.state = details.state;
                  if (details.postalCode) patch.postal_code = details.postalCode;
                  if (details.countryCode) patch.country_code = details.countryCode.toUpperCase();
                  updateRestaurantDetails(patch);
                  toast.success('Location details auto-filled!');
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // RENDER: Done step
  // ====================================================================

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Saved Successfully!</h2>
          <p className="text-gray-500 mt-2 text-lg">
            <span className="font-semibold text-gray-800">{savedCount} dishes</span> added to{' '}
            <span className="font-semibold text-gray-800">{selectedRestaurant?.name}</span>
          </p>
        </div>
        <div className="flex gap-3">
          {selectedRestaurant && (
            <Button asChild variant="outline">
              <Link href={`/admin/restaurants`}>View Restaurants</Link>
            </Button>
          )}
          <Button onClick={resetAll} className="bg-orange-600 hover:bg-orange-700 text-white">
            <ScanLine className="h-4 w-4" />
            Scan Another Menu
          </Button>
        </div>
      </div>
    );
  }

  // ====================================================================
  // RENDER: Review step
  // ====================================================================

  const totalDishes = countDishes(editableMenus);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Utensils className="h-5 w-5 text-orange-600" />
            Review: {selectedRestaurant?.name}
            <span className="text-sm font-normal text-gray-500 ml-1">({currency})</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalDishes} dish{totalDishes !== 1 ? 'es' : ''} extracted — {imageFiles.length} image
            {imageFiles.length !== 1 ? 's' : ''}. Edit as needed, then save.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setStep('upload')} disabled={saving}>
            ← Re-scan
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || totalDishes === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>Save {totalDishes} dishes to DB</>
            )}
          </Button>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex gap-5 min-h-0 flex-1">
        {/* ---- Left: Image carousel + Restaurant Details tabs ---- */}
        <div className="w-80 shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setLeftPanelTab('images')}
              className={cn(
                'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                leftPanelTab === 'images'
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              🖼️ Images
            </button>
            <button
              onClick={() => setLeftPanelTab('details')}
              className={cn(
                'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                leftPanelTab === 'details'
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Store className="h-3 w-3" />
              Details
              {restaurantDetails.dirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-0.5" />
              )}
            </button>
          </div>

          {/* IMAGES TAB */}
          {leftPanelTab === 'images' && (
            <>
              <div
                className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center relative min-h-0 cursor-zoom-in group"
                onClick={() => previewUrls.length > 0 && setLightboxOpen(true)}
              >
                {previewUrls.length > 0 ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrls[currentImageIdx]}
                      alt={`Page ${currentImageIdx + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="bg-black/50 text-white p-1.5 rounded-lg hover:bg-black/70"
                        title="Zoom in"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No preview</p>
                )}
              </div>
              {previewUrls.length > 1 ? (
                <div className="flex items-center justify-between p-3 border-t border-gray-100 shrink-0">
                  <button
                    onClick={() => setCurrentImageIdx(i => Math.max(0, i - 1))}
                    disabled={currentImageIdx === 0}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-gray-600 font-medium">
                    Page {currentImageIdx + 1} / {previewUrls.length}
                  </span>
                  <button
                    onClick={() => setCurrentImageIdx(i => Math.min(previewUrls.length - 1, i + 1))}
                    disabled={currentImageIdx === previewUrls.length - 1}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="p-2.5 border-t border-gray-100 text-center shrink-0">
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="text-xs text-gray-400 hover:text-orange-600 flex items-center gap-1 mx-auto"
                  >
                    <ZoomIn className="h-3 w-3" /> Click image to zoom
                  </button>
                </div>
              )}
            </>
          )}

          {/* DETAILS TAB */}
          {leftPanelTab === 'details' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Address</label>
                <Input
                  value={restaurantDetails.address}
                  onChange={e => updateRestaurantDetails({ address: e.target.value })}
                  placeholder="Street address"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">City</label>
                <Input
                  value={restaurantDetails.city}
                  onChange={e => updateRestaurantDetails({ city: e.target.value })}
                  placeholder="City"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Postal Code</label>
                <Input
                  value={restaurantDetails.postal_code}
                  onChange={e => updateRestaurantDetails({ postal_code: e.target.value })}
                  placeholder="e.g. 44100"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Neighbourhood</label>
                <Input
                  value={restaurantDetails.neighbourhood}
                  onChange={e => updateRestaurantDetails({ neighbourhood: e.target.value })}
                  placeholder="e.g. Zona Rosa"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                <Input
                  value={restaurantDetails.phone}
                  onChange={e => updateRestaurantDetails({ phone: e.target.value })}
                  placeholder="+52 33 …"
                  type="tel"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Website</label>
                <Input
                  value={restaurantDetails.website}
                  onChange={e => updateRestaurantDetails({ website: e.target.value })}
                  placeholder="https://"
                  type="url"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                  {restaurantDetails.lat && (
                    <span className="text-green-600 text-[10px] ml-1">✓ pinned</span>
                  )}
                </label>
                <LocationPickerComponent
                  onLocationSelect={(lat, lng) => updateRestaurantDetails({ lat, lng })}
                  onAddressSelect={addr => {
                    updateRestaurantDetails({ address: addr });
                  }}
                  onLocationDetails={details => {
                    const patch: Partial<RestaurantDetailsForm> = {};
                    if (details.city) patch.city = details.city;
                    if (details.neighbourhood) patch.neighbourhood = details.neighbourhood;
                    if (details.state) patch.state = details.state;
                    if (details.postalCode) patch.postal_code = details.postalCode;
                    if (details.countryCode) patch.country_code = details.countryCode.toUpperCase();
                    updateRestaurantDetails(patch);
                    toast.success('Location details auto-filled!');
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ---- Right: Extraction results ---- */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Suggest All toolbar */}
          {editableMenus.length > 0 && (
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-2.5">
              <p className="text-xs text-gray-500">
                {suggestAllProgress
                  ? `Analysing… ${suggestAllProgress.done} / ${suggestAllProgress.total} dishes`
                  : `${countDishes(editableMenus)} dishes extracted`}
              </p>
              <button
                type="button"
                disabled={isSuggestingAll}
                onClick={suggestAllDishes}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors font-medium"
              >
                {isSuggestingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Suggest All
              </button>
            </div>
          )}
          {editableMenus.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-3">
              <AlertTriangle className="h-10 w-10" />
              <p className="font-medium">No dishes extracted</p>
              <p className="text-sm">Try re-scanning with a clearer image.</p>
              <Button variant="outline" onClick={() => setStep('upload')}>
                ← Re-scan
              </Button>
            </div>
          ) : (
            editableMenus.map((menu, mIdx) => (
              <div
                key={mIdx}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Menu header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <input
                    value={menu.name}
                    onChange={e => updateMenu(mIdx, { name: e.target.value })}
                    className="font-semibold text-gray-800 bg-transparent border-0 border-b border-dashed border-gray-300 focus:outline-none focus:border-orange-400 min-w-0 flex-1"
                    placeholder="Menu name (e.g. Lunch)"
                  />
                  <select
                    value={menu.menu_type}
                    onChange={e =>
                      updateMenu(mIdx, { menu_type: e.target.value as 'food' | 'drink' })
                    }
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                  >
                    <option value="food">🍽️ Food</option>
                    <option value="drink">🍹 Drink</option>
                  </select>
                  <button
                    onClick={() => addCategory(mIdx)}
                    className="text-xs text-orange-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Category
                  </button>
                  <button
                    onClick={() => deleteMenu(mIdx)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Categories */}
                <div className="divide-y divide-gray-100">
                  {menu.categories.map((cat, cIdx) => (
                    <div key={cIdx} className="p-4">
                      {/* Category header */}
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          value={cat.name}
                          onChange={e => updateCategory(mIdx, cIdx, { name: e.target.value })}
                          className="text-sm font-medium text-gray-600 bg-transparent border-0 border-b border-dashed border-gray-300 focus:outline-none focus:border-orange-400 flex-1 min-w-0"
                          placeholder="Category name (e.g. Appetizers)"
                        />
                        <button
                          onClick={() => addDish(mIdx, cIdx)}
                          className="text-xs text-orange-600 hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Dish
                        </button>
                        <button
                          onClick={() => deleteCategory(mIdx, cIdx)}
                          className="p-1 text-gray-300 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Dishes */}
                      <div className="space-y-2">
                        {cat.dishes.map((dish, dIdx) => {
                          const isExpanded = expandedDishes.has(dish._id);
                          const hasUnmatched = dish.ingredients.some(i => i.status === 'unmatched');

                          return (
                            <div
                              key={dish._id}
                              className={cn(
                                'rounded-lg border p-3 transition-colors',
                                dish.confidence < 0.6
                                  ? 'border-red-200 bg-red-50/30'
                                  : dish.confidence < 0.85
                                    ? 'border-yellow-200 bg-yellow-50/20'
                                    : 'border-gray-200'
                              )}
                            >
                              {/* Collapsed row */}
                              <div className="flex items-center gap-2">
                                <input
                                  value={dish.name}
                                  onChange={e =>
                                    updateDish(mIdx, cIdx, dIdx, { name: e.target.value })
                                  }
                                  className="flex-1 font-medium text-sm bg-transparent border-0 border-b border-transparent focus:border-orange-400 focus:outline-none min-w-0"
                                  placeholder="Dish name"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-xs text-gray-400">{currency}</span>
                                  <input
                                    type="number"
                                    value={dish.price}
                                    onChange={e =>
                                      updateDish(mIdx, cIdx, dIdx, { price: e.target.value })
                                    }
                                    className="w-20 text-sm text-right border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-orange-400"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                  />
                                </div>
                                <ConfidenceBadge confidence={dish.confidence} />
                                {hasUnmatched && (
                                  <AlertTriangle
                                    className="h-4 w-4 text-orange-500 shrink-0"
                                    aria-label="Unmatched ingredients"
                                  />
                                )}
                                <button
                                  onClick={() => toggleExpand(dish._id)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => deleteDish(mIdx, cIdx, dIdx)}
                                  className="p-1 text-gray-300 hover:text-red-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {/* Expanded detail */}
                              {isExpanded && (
                                <div className="mt-3 space-y-3 pl-1">
                                  {/* Description */}
                                  <textarea
                                    value={dish.description}
                                    onChange={e =>
                                      updateDish(mIdx, cIdx, dIdx, { description: e.target.value })
                                    }
                                    rows={2}
                                    placeholder="Description (optional)"
                                    className="w-full text-sm border border-gray-200 rounded px-3 py-2 resize-none focus:outline-none focus:border-orange-400"
                                  />

                                  {/* Dietary tags */}
                                  {dietaryTags.length > 0 && (
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1.5">Dietary Tags</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {dietaryTags.map(tag => {
                                          const active = dish.dietary_tags.includes(tag.code);
                                          return (
                                            <button
                                              key={tag.code}
                                              type="button"
                                              onClick={() => {
                                                const next = active
                                                  ? dish.dietary_tags.filter(c => c !== tag.code)
                                                  : [...dish.dietary_tags, tag.code];
                                                updateDish(mIdx, cIdx, dIdx, {
                                                  dietary_tags: next,
                                                });
                                              }}
                                              className={cn(
                                                'text-xs px-2 py-0.5 rounded-full border transition-colors',
                                                active
                                                  ? 'bg-green-100 border-green-300 text-green-800'
                                                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                              )}
                                            >
                                              <span className="mr-0.5">
                                                {getDietaryTagIcon(tag.code)}
                                              </span>
                                              {tag.name}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Ingredients */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <p className="text-xs text-gray-500">Ingredients</p>
                                      <div className="flex items-center gap-1">
                                        {/* AI Suggest */}
                                        <button
                                          type="button"
                                          disabled={suggestingDishId === dish._id}
                                          onClick={() =>
                                            suggestIngredients(
                                              dish._id,
                                              dish.name,
                                              dish.description,
                                              mIdx,
                                              cIdx,
                                              dIdx
                                            )
                                          }
                                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors"
                                          title="Suggest ingredients from dish name & description"
                                        >
                                          {suggestingDishId === dish._id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Sparkles className="h-3 w-3" />
                                          )}
                                          Suggest
                                        </button>
                                        {/* Inline Add */}
                                        {!(
                                          inlineSearchTarget?.mIdx === mIdx &&
                                          inlineSearchTarget?.cIdx === cIdx &&
                                          inlineSearchTarget?.dIdx === dIdx
                                        ) && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setInlineSearchTarget({ mIdx, cIdx, dIdx })
                                            }
                                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
                                          >
                                            <Plus className="h-3 w-3" />
                                            Add
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Ingredient pills */}
                                    {dish.ingredients.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                                        {dish.ingredients.map((ing, ingIdx) => {
                                          const matched = ing.status === 'matched';
                                          const hasSubs = (ing.sub_ingredients?.length ?? 0) > 0;
                                          const isVariantActive =
                                            matched &&
                                            subIngredientEditTarget?.mIdx === mIdx &&
                                            subIngredientEditTarget?.cIdx === cIdx &&
                                            subIngredientEditTarget?.dIdx === dIdx &&
                                            subIngredientEditTarget?.ingIdx === ingIdx;

                                          return (
                                            <div
                                              key={ingIdx}
                                              className={cn(
                                                'text-xs rounded-full flex items-center',
                                                matched
                                                  ? 'bg-gray-100 text-gray-700'
                                                  : 'bg-orange-50 text-orange-700 border border-orange-200'
                                              )}
                                            >
                                              {/* Pill body — opens re-link / link panel */}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setAddIngredientTarget({
                                                    menuIdx: mIdx,
                                                    catIdx: cIdx,
                                                    dishIdx: dIdx,
                                                    rawText: matched
                                                      ? ing.display_name || ing.raw_text
                                                      : ing.raw_text,
                                                  })
                                                }
                                                className={cn(
                                                  'flex items-center gap-1 pl-2 pr-0.5 py-0.5 rounded-l-full transition-colors',
                                                  matched
                                                    ? 'hover:bg-gray-200'
                                                    : 'hover:bg-orange-100'
                                                )}
                                                title={
                                                  matched
                                                    ? `Re-link: ${ing.canonical_name}`
                                                    : 'Link to ingredient'
                                                }
                                              >
                                                {!matched && (
                                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                                )}
                                                {hasSubs && (
                                                  <Layers className="h-2.5 w-2.5 text-indigo-400 shrink-0" />
                                                )}
                                                <span>{ing.display_name || ing.raw_text}</span>
                                                {hasSubs && (
                                                  <span className="text-indigo-400 text-[10px]">
                                                    ({ing.sub_ingredients!.length})
                                                  </span>
                                                )}
                                              </button>
                                              {/* Variant toggle (matched only) */}
                                              {matched && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setSubIngredientEditTarget(
                                                      isVariantActive
                                                        ? null
                                                        : { mIdx, cIdx, dIdx, ingIdx }
                                                    )
                                                  }
                                                  className={cn(
                                                    'px-0.5 py-0.5 transition-colors',
                                                    isVariantActive
                                                      ? 'text-indigo-500 bg-indigo-50 rounded'
                                                      : 'text-gray-300 hover:text-indigo-500'
                                                  )}
                                                  title="Add/edit variants (e.g., choice of meat)"
                                                >
                                                  <Layers className="h-2.5 w-2.5" />
                                                </button>
                                              )}
                                              {/* Delete ingredient */}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeIngredientFromDish(mIdx, cIdx, dIdx, ingIdx)
                                                }
                                                className={cn(
                                                  'flex items-center pr-1.5 py-0.5 rounded-r-full transition-colors',
                                                  matched
                                                    ? 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                                                    : 'text-orange-300 hover:text-red-500 hover:bg-red-50'
                                                )}
                                                title="Remove ingredient"
                                              >
                                                <X className="h-2.5 w-2.5" />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Sub-ingredient / variant editor */}
                                    {(() => {
                                      if (
                                        !subIngredientEditTarget ||
                                        subIngredientEditTarget.mIdx !== mIdx ||
                                        subIngredientEditTarget.cIdx !== cIdx ||
                                        subIngredientEditTarget.dIdx !== dIdx
                                      )
                                        return null;
                                      const parentIngIdx = subIngredientEditTarget.ingIdx;
                                      const parentIng = dish.ingredients[parentIngIdx];
                                      if (!parentIng || parentIng.status !== 'matched') return null;
                                      const subs = parentIng.sub_ingredients ?? [];
                                      return (
                                        <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-2 mb-1.5">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                                              <Layers className="h-3 w-3" />
                                              Variants of &ldquo;
                                              {parentIng.display_name || parentIng.raw_text}
                                              &rdquo;
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => setSubIngredientEditTarget(null)}
                                              className="text-gray-400 hover:text-gray-600"
                                            >
                                              <X className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                          {subs.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1.5">
                                              {subs.map((sub, subIdx) => (
                                                <div
                                                  key={subIdx}
                                                  className="text-xs bg-indigo-100 text-indigo-700 rounded-full flex items-center"
                                                >
                                                  <span className="pl-2 pr-0.5 py-0.5">
                                                    {sub.display_name || sub.raw_text}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      removeSubIngredient(
                                                        mIdx,
                                                        cIdx,
                                                        dIdx,
                                                        parentIngIdx,
                                                        subIdx
                                                      )
                                                    }
                                                    className="pr-1.5 py-0.5 text-indigo-400 hover:text-red-500 rounded-r-full transition-colors"
                                                    title="Remove variant"
                                                  >
                                                    <X className="h-2.5 w-2.5" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          <p className="text-[10px] text-indigo-400 mb-1">
                                            Search for specific variants (e.g., beef, chicken, pork)
                                          </p>
                                          <InlineIngredientSearch
                                            existingIds={
                                              new Set([
                                                ...(parentIng.canonical_ingredient_id
                                                  ? [parentIng.canonical_ingredient_id]
                                                  : []),
                                                ...subs
                                                  .map(s => s.canonical_ingredient_id)
                                                  .filter((id): id is string => Boolean(id)),
                                              ])
                                            }
                                            onAdd={sub =>
                                              addSubIngredient(mIdx, cIdx, dIdx, parentIngIdx, sub)
                                            }
                                            onClose={() => setSubIngredientEditTarget(null)}
                                          />
                                        </div>
                                      );
                                    })()}

                                    {/* Inline ingredient search */}
                                    {inlineSearchTarget?.mIdx === mIdx &&
                                      inlineSearchTarget?.cIdx === cIdx &&
                                      inlineSearchTarget?.dIdx === dIdx && (
                                        <InlineIngredientSearch
                                          existingIds={
                                            new Set(
                                              dish.ingredients
                                                .map(i => i.canonical_ingredient_id)
                                                .filter((id): id is string => Boolean(id))
                                            )
                                          }
                                          onAdd={ing => {
                                            addIngredientToDish(mIdx, cIdx, dIdx, ing);
                                          }}
                                          onClose={() => setInlineSearchTarget(null)}
                                        />
                                      )}

                                    {/* AI allergen hints */}
                                    {(dish.suggested_allergens ?? []).length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100">
                                        <span className="text-xs text-gray-400 mr-0.5">
                                          ⚠️ AI hints:
                                        </span>
                                        {dish.suggested_allergens!.map(code => (
                                          <span
                                            key={code}
                                            className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full"
                                            title="AI-suggested allergen — confirmed automatically from matched ingredients on save"
                                          >
                                            {getAllergenIcon(code)} {code.replace(/_/g, ' ')}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Dish category + extra fields row */}
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex-1 min-w-40">
                                      <p className="text-xs text-gray-500 mb-1">Dish Category</p>
                                      <select
                                        value={dish.dish_category_id ?? ''}
                                        onChange={async e => {
                                          const val = e.target.value;
                                          if (val === '__new__') {
                                            const name = prompt('New category name:');
                                            if (!name?.trim()) return;
                                            const { data: created, error } =
                                              await createDishCategory({
                                                name: name.trim(),
                                                is_drink: false,
                                              });
                                            if (error || !created) {
                                              toast.error(
                                                `Failed to create category: ${error?.message ?? 'unknown'}`
                                              );
                                              return;
                                            }
                                            setDishCategories(prev =>
                                              [...prev, created].sort((a, b) =>
                                                a.name.localeCompare(b.name)
                                              )
                                            );
                                            updateDish(mIdx, cIdx, dIdx, {
                                              dish_category_id: created.id,
                                            });
                                            toast.success(`Category "${created.name}" created`);
                                          } else {
                                            updateDish(mIdx, cIdx, dIdx, {
                                              dish_category_id: val || null,
                                            });
                                          }
                                        }}
                                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-orange-400"
                                      >
                                        <option value="">— None —</option>
                                        {dishCategories.map(dc => (
                                          <option key={dc.id} value={dc.id}>
                                            {dc.name}
                                          </option>
                                        ))}
                                        <option value="__new__">➕ New category…</option>
                                      </select>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Spice</p>
                                      <select
                                        value={dish.spice_level ?? ''}
                                        onChange={e =>
                                          updateDish(mIdx, cIdx, dIdx, {
                                            spice_level:
                                              e.target.value === ''
                                                ? null
                                                : (e.target.value as 'none' | 'mild' | 'hot'),
                                          })
                                        }
                                        className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-orange-400"
                                      >
                                        <option value="">—</option>
                                        <option value="none">No spice</option>
                                        <option value="mild">🌶️</option>
                                        <option value="hot">🌶️🌶️🌶️</option>
                                      </select>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Calories</p>
                                      <input
                                        type="number"
                                        value={dish.calories ?? ''}
                                        onChange={e =>
                                          updateDish(mIdx, cIdx, dIdx, {
                                            calories: e.target.value
                                              ? Number(e.target.value)
                                              : null,
                                          })
                                        }
                                        className="w-20 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400"
                                        placeholder="kcal"
                                        min="0"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Add dish button */}
                        <button
                          onClick={() => addDish(mIdx, cIdx)}
                          className="w-full text-sm text-orange-600 hover:text-orange-700 border border-dashed border-orange-200 rounded-lg py-2 hover:border-orange-300 hover:bg-orange-50 transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="h-4 w-4" /> Add Dish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Add menu section button */}
          <button
            onClick={addMenu}
            className="w-full text-sm text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-xl py-3 hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="h-4 w-4" /> Add Menu Section
          </button>

          {/* Bottom save bar */}
          <div className="sticky bottom-0 pb-2">
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-lg">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{totalDishes} dishes</span> ready to
                save
              </p>
              <Button
                onClick={handleSave}
                disabled={saving || totalDishes === 0}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>Save & Commit to Database</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Zoom Lightbox ---- */}
      {lightboxOpen && previewUrls.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
          {previewUrls.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-3 hover:bg-white/10 rounded-full disabled:opacity-30 transition-colors"
                onClick={e => {
                  e.stopPropagation();
                  setCurrentImageIdx(i => Math.max(0, i - 1));
                }}
                disabled={currentImageIdx === 0}
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-3 hover:bg-white/10 rounded-full disabled:opacity-30 transition-colors"
                onClick={e => {
                  e.stopPropagation();
                  setCurrentImageIdx(i => Math.min(previewUrls.length - 1, i + 1));
                }}
                disabled={currentImageIdx === previewUrls.length - 1}
              >
                <ChevronRight className="h-8 w-8" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                {currentImageIdx + 1} / {previewUrls.length}
              </div>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrls[currentImageIdx]}
            alt="Menu zoom"
            className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Add Ingredient slide-over */}
      {addIngredientTarget && (
        <AddIngredientPanel
          rawText={addIngredientTarget.rawText}
          onSuccess={resolved => {
            resolveIngredient(
              addIngredientTarget.menuIdx,
              addIngredientTarget.catIdx,
              addIngredientTarget.dishIdx,
              addIngredientTarget.rawText,
              resolved
            );
            setAddIngredientTarget(null);
          }}
          onClose={() => setAddIngredientTarget(null)}
        />
      )}
    </div>
  );
}
