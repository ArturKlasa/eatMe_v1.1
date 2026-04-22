import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createUploadSlice, UploadSlice } from '../uploadSlice';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

vi.mock('@/lib/menu-scan-utils', () => ({
  pdfToImages: vi.fn().mockResolvedValue([]),
  resizeImageToBase64: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function makeStore() {
  return createStore<UploadSlice>()(createUploadSlice);
}

describe('uploadSlice — initial state', () => {
  it('starts with empty collections and false flags', () => {
    const store = makeStore();
    const s = store.getState();
    expect(s.restaurants).toEqual([]);
    expect(s.imageFiles).toEqual([]);
    expect(s.previewUrls).toEqual([]);
    expect(s.selectedRestaurant).toBeNull();
    expect(s.isDragging).toBe(false);
    expect(s.isPdfConverting).toBe(false);
    expect(s.currentImageIdx).toBe(0);
  });
});

describe('uploadSlice — simple setters', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('setRestaurantSearch updates search string', () => {
    store.getState().setRestaurantSearch('pizza');
    expect(store.getState().restaurantSearch).toBe('pizza');
  });

  it('setShowRestaurantDropdown toggles dropdown', () => {
    store.getState().setShowRestaurantDropdown(true);
    expect(store.getState().showRestaurantDropdown).toBe(true);
  });

  it('setSelectedRestaurant stores the restaurant', () => {
    const r = { id: '1', name: 'Bistro', city: 'NY', country_code: 'US' };
    store.getState().setSelectedRestaurant(r);
    expect(store.getState().selectedRestaurant).toEqual(r);
  });

  it('setCurrentImageIdx updates carousel index', () => {
    store.getState().setCurrentImageIdx(3);
    expect(store.getState().currentImageIdx).toBe(3);
  });

  it('setIsDragging sets drag flag', () => {
    store.getState().setIsDragging(true);
    expect(store.getState().isDragging).toBe(true);
  });

  it('setRestaurantsWithoutMenu stores list', () => {
    const list = [{ id: 'a', name: 'X', city: null, country_code: null }];
    store.getState().setRestaurantsWithoutMenu(list);
    expect(store.getState().restaurantsWithoutMenu).toEqual(list);
  });
});

describe('uploadSlice — removeImage', () => {
  it('removes image and revokes URL, adjusts currentImageIdx', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const store = makeStore();

    const mockFiles = [
      new File(['a'], 'a.jpg'),
      new File(['b'], 'b.jpg'),
      new File(['c'], 'c.jpg'),
    ];
    const mockUrls = ['blob:a', 'blob:b', 'blob:c'];
    store.setState({ imageFiles: mockFiles, previewUrls: mockUrls, currentImageIdx: 2 });

    store.getState().removeImage(1);

    const s = store.getState();
    expect(s.imageFiles).toHaveLength(2);
    expect(s.previewUrls).toHaveLength(2);
    expect(s.previewUrls).not.toContain('blob:b');
    expect(revokeSpy).toHaveBeenCalledWith('blob:b');

    revokeSpy.mockRestore();
  });

  it('clamps currentImageIdx when removing the last image', () => {
    const store = makeStore();
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    store.setState({
      imageFiles: [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')],
      previewUrls: ['blob:a', 'blob:b'],
      currentImageIdx: 1,
    });

    store.getState().removeImage(1);
    expect(store.getState().currentImageIdx).toBe(0);
  });
});

describe('uploadSlice — skipRestaurantFromMenuScan', () => {
  it('removes restaurant from restaurantsWithoutMenu on success', async () => {
    const store = makeStore();
    store.setState({
      restaurantsWithoutMenu: [
        { id: 'r1', name: 'A', city: null, country_code: null },
        { id: 'r2', name: 'B', city: null, country_code: null },
      ],
    });

    await store.getState().skipRestaurantFromMenuScan('r1');

    expect(store.getState().restaurantsWithoutMenu).toHaveLength(1);
    expect(store.getState().restaurantsWithoutMenu[0].id).toBe('r2');
  });
});

describe('uploadSlice — resetUpload', () => {
  it('resets all upload state to initial values', () => {
    const store = makeStore();
    store.setState({
      restaurants: [{ id: '1', name: 'A', city: null, country_code: null }],
      restaurantSearch: 'hello',
      currentImageIdx: 5,
      isDragging: true,
    });

    store.getState().resetUpload();

    const s = store.getState();
    expect(s.restaurants).toEqual([]);
    expect(s.restaurantSearch).toBe('');
    expect(s.currentImageIdx).toBe(0);
    expect(s.isDragging).toBe(false);
  });
});

describe('uploadSlice — handleFilesSelected', () => {
  it('adds image files and creates preview URLs (capped at 20)', async () => {
    const createObjectSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation(f => `blob:${(f as File).name}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const store = makeStore();
    const files = [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })];

    await store.getState().handleFilesSelected(files);

    const s = store.getState();
    expect(s.imageFiles).toHaveLength(1);
    expect(s.previewUrls).toEqual(['blob:photo.jpg']);

    createObjectSpy.mockRestore();
  });
});
