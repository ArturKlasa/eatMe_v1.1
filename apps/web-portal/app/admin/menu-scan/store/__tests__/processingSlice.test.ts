import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createUploadSlice } from '../uploadSlice';
import { createProcessingSlice, ProcessingSlice } from '../processingSlice';
import type { UploadSlice } from '../uploadSlice';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'tok_test' } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  resizeImageToBase64: vi
    .fn()
    .mockImplementation((f: File) => Promise.resolve(`data:image/jpeg;base64,${f.name}`)),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function makeStore() {
  return createStore<UploadSlice & ProcessingSlice>()((...a) => ({
    ...createUploadSlice(...a),
    ...createProcessingSlice(...a),
  }));
}

describe('processingSlice — fireProcess', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
  });

  it('returns null and shows toast when no restaurant selected', async () => {
    const { toast } = await import('sonner');
    const result = await store.getState().fireProcess();
    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Please select a restaurant');
  });

  it('returns null when no image files uploaded', async () => {
    const { toast } = await import('sonner');
    store.setState({
      selectedRestaurant: { id: 'r1', name: 'Bistro', city: null, country_code: null },
    });
    const result = await store.getState().fireProcess();
    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Please upload at least one image or PDF');
  });

  it('returns null when PDF is still converting', async () => {
    const { toast } = await import('sonner');
    store.setState({
      selectedRestaurant: { id: 'r1', name: 'Bistro', city: null, country_code: null },
      imageFiles: [new File(['x'], 'page.jpg')],
      isPdfConverting: true,
    });
    const result = await store.getState().fireProcess();
    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('PDF is still converting — please wait a moment');
  });

  it('returns FireResult with fetch promise on valid inputs', async () => {
    const restaurant = { id: 'r1', name: 'Bistro', city: null, country_code: null };
    store.setState({
      selectedRestaurant: restaurant,
      imageFiles: [new File(['x'], 'menu.jpg', { type: 'image/jpeg' })],
      isPdfConverting: false,
    });

    const result = await store.getState().fireProcess();

    expect(result).not.toBeNull();
    expect(result?.restaurantId).toBe('r1');
    expect(result?.restaurantName).toBe('Bistro');
    expect(result?.fetchPromise).toBeInstanceOf(Promise);
  });

  it('fires POST to /api/menu-scan with correct headers and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    store.setState({
      selectedRestaurant: { id: 'r1', name: 'Bistro', city: null, country_code: null },
      imageFiles: [new File(['x'], 'img.jpg', { type: 'image/jpeg' })],
    });

    await store.getState().fireProcess();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/menu-scan',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok_test',
          'Content-Type': 'application/json',
        }),
      })
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.restaurant_id).toBe('r1');
    expect(Array.isArray(body.images)).toBe(true);
  });
});
