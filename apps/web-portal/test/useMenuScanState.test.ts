import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMenuScanState } from '@/app/admin/menu-scan/hooks/useMenuScanState';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
  formatLocationForSupabase: vi.fn(),
}));

vi.mock('@/lib/dish-categories', () => ({
  fetchDishCategories: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('@/lib/menu-scan-utils', () => ({
  resizeImageToBase64: vi.fn().mockResolvedValue({
    name: 'test.jpg',
    mime_type: 'image/jpeg',
    data: 'base64data',
  }),
  pdfToImages: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMenuScanState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with step = "upload"', () => {
    const { result } = renderHook(() => useMenuScanState());
    expect(result.current.step).toBe('upload');
  });

  it('starts with empty imageFiles', () => {
    const { result } = renderHook(() => useMenuScanState());
    expect(result.current.imageFiles).toEqual([]);
  });

  it('starts with empty uploadedFiles alias', () => {
    const { result } = renderHook(() => useMenuScanState());
    expect(result.current.uploadedFiles).toEqual([]);
  });

  it('starts with empty selectedDishes (selectedGroupIds alias)', () => {
    const { result } = renderHook(() => useMenuScanState());
    expect(result.current.selectedDishes.size).toBe(0);
  });

  it('setImageFiles updates imageFiles', () => {
    const { result } = renderHook(() => useMenuScanState());
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    act(() => {
      result.current.setImageFiles([file]);
    });

    expect(result.current.imageFiles).toHaveLength(1);
    expect(result.current.uploadedFiles).toHaveLength(1);
  });

  it('toggleExpand adds a dish id to expandedDishes', () => {
    const { result } = renderHook(() => useMenuScanState());

    act(() => {
      result.current.toggleExpand('dish-123');
    });

    expect(result.current.expandedDishes.has('dish-123')).toBe(true);
  });

  it('toggleExpand removes an already-expanded dish id', () => {
    const { result } = renderHook(() => useMenuScanState());

    act(() => {
      result.current.toggleExpand('dish-123');
    });
    act(() => {
      result.current.toggleExpand('dish-123');
    });

    expect(result.current.expandedDishes.has('dish-123')).toBe(false);
  });

  it('setSelectedGroupIds updates selectedDishes alias', () => {
    const { result } = renderHook(() => useMenuScanState());

    act(() => {
      result.current.setSelectedGroupIds(new Set(['dish-a', 'dish-b']));
    });

    expect(result.current.selectedDishes.has('dish-a')).toBe(true);
    expect(result.current.selectedDishes.has('dish-b')).toBe(true);
  });

  it('resetAll resets step back to "upload"', () => {
    const { result } = renderHook(() => useMenuScanState());

    act(() => {
      result.current.setStep('review');
    });
    expect(result.current.step).toBe('review');

    act(() => {
      result.current.resetAll();
    });
    expect(result.current.step).toBe('upload');
  });

  it('resetAll clears imageFiles', () => {
    const { result } = renderHook(() => useMenuScanState());
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });

    act(() => {
      result.current.setImageFiles([file]);
    });
    act(() => {
      result.current.resetAll();
    });

    expect(result.current.imageFiles).toHaveLength(0);
  });

  it('setStep transitions step to "processing"', () => {
    const { result } = renderHook(() => useMenuScanState());

    act(() => {
      result.current.setStep('processing');
    });

    expect(result.current.step).toBe('processing');
  });

  it('setStep transitions step to "review"', () => {
    const { result } = renderHook(() => useMenuScanState());

    act(() => {
      result.current.setStep('review');
    });

    expect(result.current.step).toBe('review');
  });

  it('setStep transitions step to "done"', () => {
    const { result } = renderHook(() => useMenuScanState());

    act(() => {
      result.current.setStep('done');
    });

    expect(result.current.step).toBe('done');
  });

  it('addDish adds a dish to the specified category and expands it', () => {
    const { result } = renderHook(() => useMenuScanState());

    // Set up a minimal menu structure
    act(() => {
      result.current.setEditableMenus([
        {
          name: 'Test Menu',
          menu_type: 'food',
          categories: [{ name: 'Starters', dishes: [] }],
        } as import('@/lib/menu-scan').EditableMenu,
      ]);
    });

    act(() => {
      result.current.addDish(0, 0);
    });

    expect(result.current.editableMenus[0].categories[0].dishes).toHaveLength(1);
    const dishId = result.current.editableMenus[0].categories[0].dishes[0]._id;
    expect(result.current.expandedDishes.has(dishId)).toBe(true);
  });
});
