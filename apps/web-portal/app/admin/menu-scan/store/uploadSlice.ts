import { StateCreator } from 'zustand';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { pdfToImages } from '@/lib/menu-scan-utils';
import type { RestaurantOption } from '../hooks/menuScanTypes';

export interface UploadSlice {
  // State
  restaurants: RestaurantOption[];
  restaurantSearch: string;
  showRestaurantDropdown: boolean;
  selectedRestaurant: RestaurantOption | null;
  isPreSelected: boolean;
  showQuickAdd: boolean;
  quickAddInitialName: string;
  imageFiles: File[];
  previewUrls: string[];
  isDragging: boolean;
  isPdfConverting: boolean;
  currentImageIdx: number;
  restaurantsWithoutMenu: RestaurantOption[];

  // Setters — some accept functional updater form to match React Dispatch<SetStateAction<T>> callsites
  setRestaurants: (
    v: RestaurantOption[] | ((prev: RestaurantOption[]) => RestaurantOption[])
  ) => void;
  setRestaurantSearch: (search: string) => void;
  setShowRestaurantDropdown: (show: boolean) => void;
  setSelectedRestaurant: (restaurant: RestaurantOption | null) => void;
  setIsPreSelected: (val: boolean) => void;
  setShowQuickAdd: (v: boolean | ((prev: boolean) => boolean)) => void;
  setQuickAddInitialName: (name: string) => void;
  setImageFiles: (files: File[]) => void;
  setPreviewUrls: (v: string[] | ((prev: string[]) => string[])) => void;
  setIsDragging: (val: boolean) => void;
  setIsPdfConverting: (val: boolean) => void;
  setCurrentImageIdx: (v: number | ((prev: number) => number)) => void;
  setRestaurantsWithoutMenu: (restaurants: RestaurantOption[]) => void;

  // Async actions
  loadRestaurants: () => Promise<void>;
  selectRestaurantById: (id: string) => Promise<void>;
  skipRestaurantFromMenuScan: (restaurantId: string) => Promise<void>;

  // File actions
  handleFilesSelected: (files: FileList | File[]) => Promise<void>;
  removeImage: (idx: number) => void;

  // Reset
  resetUpload: () => void;
}

const initialState = {
  restaurants: [] as RestaurantOption[],
  restaurantSearch: '',
  showRestaurantDropdown: false,
  selectedRestaurant: null as RestaurantOption | null,
  isPreSelected: false,
  showQuickAdd: false,
  quickAddInitialName: '',
  imageFiles: [] as File[],
  previewUrls: [] as string[],
  isDragging: false,
  isPdfConverting: false,
  currentImageIdx: 0,
  restaurantsWithoutMenu: [] as RestaurantOption[],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createUploadSlice: StateCreator<any, [], [], UploadSlice> = (set, get) => ({
  ...initialState,

  setRestaurants: v =>
    set((s: UploadSlice) => ({ restaurants: typeof v === 'function' ? v(s.restaurants) : v })),
  setRestaurantSearch: restaurantSearch => set({ restaurantSearch }),
  setShowRestaurantDropdown: showRestaurantDropdown => set({ showRestaurantDropdown }),
  setSelectedRestaurant: selectedRestaurant => set({ selectedRestaurant }),
  setIsPreSelected: isPreSelected => set({ isPreSelected }),
  setShowQuickAdd: v =>
    set((s: UploadSlice) => ({ showQuickAdd: typeof v === 'function' ? v(s.showQuickAdd) : v })),
  setQuickAddInitialName: quickAddInitialName => set({ quickAddInitialName }),
  setImageFiles: imageFiles => set({ imageFiles }),
  setPreviewUrls: v =>
    set((s: UploadSlice) => ({ previewUrls: typeof v === 'function' ? v(s.previewUrls) : v })),
  setIsDragging: isDragging => set({ isDragging }),
  setIsPdfConverting: isPdfConverting => set({ isPdfConverting }),
  setCurrentImageIdx: v =>
    set((s: UploadSlice) => ({
      currentImageIdx: typeof v === 'function' ? v(s.currentImageIdx) : v,
    })),
  setRestaurantsWithoutMenu: restaurantsWithoutMenu => set({ restaurantsWithoutMenu }),

  loadRestaurants: async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, city, country_code')
      .order('name');
    if (error) {
      console.error('[MenuScan] Failed to load restaurants:', error.message);
      return;
    }
    const all = (data as RestaurantOption[]) ?? [];

    const [{ data: dishRows }, { data: skipRows }] = await Promise.all([
      supabase.from('dishes').select('restaurant_id'),
      supabase.from('restaurants').select('id').eq('skip_menu_scan', true),
    ]);
    const withDishes = new Set(
      (dishRows ?? [])
        .map((d: { restaurant_id: string | null }) => d.restaurant_id)
        .filter((id): id is string => id !== null)
    );
    const skipped = new Set((skipRows ?? []).map((r: { id: string }) => r.id));
    set({
      restaurants: all,
      restaurantsWithoutMenu: all.filter(r => !withDishes.has(r.id) && !skipped.has(r.id)),
    });
  },

  selectRestaurantById: async (id: string) => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, city, country_code')
      .eq('id', id)
      .single();
    if (error || !data) {
      toast.warning('Restaurant not found — please select one from the list');
      return;
    }
    const r = data as RestaurantOption;
    set({ selectedRestaurant: r, restaurantSearch: r.name, isPreSelected: true });
  },

  skipRestaurantFromMenuScan: async (restaurantId: string) => {
    const { error } = await supabase
      .from('restaurants')
      .update({ skip_menu_scan: true })
      .eq('id', restaurantId);
    if (error) {
      toast.error('Failed to skip restaurant');
      console.error('[MenuScan] skip_menu_scan update failed:', error.message);
      return;
    }
    set((state: UploadSlice) => ({
      restaurantsWithoutMenu: state.restaurantsWithoutMenu.filter(r => r.id !== restaurantId),
    }));
    toast.success('Removed from list');
  },

  handleFilesSelected: async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const images = arr.filter(f => f.type.startsWith('image/'));
    const pdfs = arr.filter(f => f.type === 'application/pdf');

    let allNew: File[] = [...images];

    if (pdfs.length > 0) {
      set({ isPdfConverting: true });
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
        set({ isPdfConverting: false });
      }
    }

    const { imageFiles: current, previewUrls: currentUrls } = get() as UploadSlice;
    const combined = [...current, ...allNew].slice(0, 20);
    currentUrls.forEach(url => URL.revokeObjectURL(url));
    set({
      imageFiles: combined,
      previewUrls: combined.map(f => URL.createObjectURL(f)),
    });
  },

  removeImage: (idx: number) => {
    const { previewUrls, imageFiles, currentImageIdx } = get() as UploadSlice;
    URL.revokeObjectURL(previewUrls[idx]);
    const newFiles = imageFiles.filter((_, i) => i !== idx);
    const newUrls = previewUrls.filter((_, i) => i !== idx);
    const newIdx =
      currentImageIdx >= imageFiles.length - 1
        ? Math.max(0, imageFiles.length - 2)
        : currentImageIdx;
    set({ imageFiles: newFiles, previewUrls: newUrls, currentImageIdx: newIdx });
  },

  resetUpload: () => set(initialState),
});
