import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser-image-compression
vi.mock('browser-image-compression', () => ({
  default: vi.fn(),
}));

import imageCompression from 'browser-image-compression';

const mockUpload = vi.fn();
const mockFrom = vi.fn(() => ({ upload: mockUpload }));

function makeSupabase() {
  return {
    storage: { from: mockFrom },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('compressImage', () => {
  it('compresses with correct options', async () => {
    const original = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const compressed = new File(['compressed'], 'photo.jpg', { type: 'image/jpeg' });
    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);

    const { compressImage } = await import('@/lib/upload');
    const result = await compressImage(original);

    expect(imageCompression).toHaveBeenCalledWith(original, {
      maxSizeMB: 2,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    });
    expect(result).toBe(compressed);
  });
});

describe('uploadCompressedRestaurantPhoto', () => {
  it('uploads to restaurant-photos/<restaurantId>/hero.jpg', async () => {
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' });
    mockUpload.mockResolvedValue({ error: null });

    const { uploadCompressedRestaurantPhoto } = await import('@/lib/upload');
    const path = await uploadCompressedRestaurantPhoto(
      'rest-abc',
      compressed,
      makeSupabase() as any
    );

    expect(mockFrom).toHaveBeenCalledWith('restaurant-photos');
    expect(mockUpload).toHaveBeenCalledWith('restaurant-photos/rest-abc/hero.jpg', compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    expect(path).toBe('restaurant-photos/rest-abc/hero.jpg');
  });

  it('throws when storage upload returns an error', async () => {
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' });
    mockUpload.mockResolvedValue({ error: new Error('storage error') });

    const { uploadCompressedRestaurantPhoto } = await import('@/lib/upload');
    await expect(
      uploadCompressedRestaurantPhoto('rest-abc', compressed, makeSupabase() as any)
    ).rejects.toThrow('storage error');
  });

  it('does NOT call imageCompression', async () => {
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' });
    mockUpload.mockResolvedValue({ error: null });

    const { uploadCompressedRestaurantPhoto } = await import('@/lib/upload');
    await uploadCompressedRestaurantPhoto('rest-xyz', compressed, makeSupabase() as any);

    expect(imageCompression).not.toHaveBeenCalled();
  });
});

describe('uploadRestaurantPhoto', () => {
  it('compresses the image with correct options', async () => {
    const original = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const compressed = new File(['compressed'], 'photo.jpg', { type: 'image/jpeg' });

    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);
    mockUpload.mockResolvedValue({ error: null });

    const { uploadRestaurantPhoto } = await import('@/lib/upload');
    await uploadRestaurantPhoto('rest-123', original, makeSupabase() as any);

    expect(imageCompression).toHaveBeenCalledWith(original, {
      maxSizeMB: 2,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    });
  });

  it('uploads to restaurant-photos/<restaurantId>/hero.jpg', async () => {
    const original = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' });

    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);
    mockUpload.mockResolvedValue({ error: null });

    const { uploadRestaurantPhoto } = await import('@/lib/upload');
    const path = await uploadRestaurantPhoto('rest-abc', original, makeSupabase() as any);

    expect(mockFrom).toHaveBeenCalledWith('restaurant-photos');
    expect(mockUpload).toHaveBeenCalledWith('restaurant-photos/rest-abc/hero.jpg', compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    expect(path).toBe('restaurant-photos/rest-abc/hero.jpg');
  });

  it('throws when storage upload returns an error', async () => {
    const original = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' });

    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);
    mockUpload.mockResolvedValue({ error: new Error('storage error') });

    const { uploadRestaurantPhoto } = await import('@/lib/upload');
    await expect(
      uploadRestaurantPhoto('rest-abc', original, makeSupabase() as any)
    ).rejects.toThrow('storage error');
  });

  it('uploads the compressed file (not original)', async () => {
    const original = new File(['original-data-much-larger'], 'photo.png', { type: 'image/png' });
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' });

    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);
    mockUpload.mockResolvedValue({ error: null });

    const { uploadRestaurantPhoto } = await import('@/lib/upload');
    await uploadRestaurantPhoto('rest-xyz', original, makeSupabase() as any);

    const uploadedFile = mockUpload.mock.calls[0][1] as File;
    expect(uploadedFile).toBe(compressed);
    expect(uploadedFile).not.toBe(original);
  });
});

// ─── uploadCompressedDishPhoto ────────────────────────────────────────────────

describe('uploadCompressedDishPhoto', () => {
  it('uploads to dish-photos/<dishId>/hero.jpg', async () => {
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' });
    mockUpload.mockResolvedValue({ error: null });

    const { uploadCompressedDishPhoto } = await import('@/lib/upload');
    const path = await uploadCompressedDishPhoto('dish-abc', compressed, makeSupabase() as never);

    expect(mockFrom).toHaveBeenCalledWith('dish-photos');
    expect(mockUpload).toHaveBeenCalledWith('dish-photos/dish-abc/hero.jpg', compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    expect(path).toBe('dish-photos/dish-abc/hero.jpg');
  });

  it('throws when storage upload returns an error', async () => {
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' });
    mockUpload.mockResolvedValue({ error: new Error('storage error') });

    const { uploadCompressedDishPhoto } = await import('@/lib/upload');
    await expect(
      uploadCompressedDishPhoto('dish-abc', compressed, makeSupabase() as never)
    ).rejects.toThrow('storage error');
  });
});

// ─── uploadDishPhoto ──────────────────────────────────────────────────────────

describe('uploadDishPhoto', () => {
  it('compresses and uploads to dish-photos/<dishId>/hero.jpg', async () => {
    const original = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const compressed = new File(['compressed'], 'photo.jpg', { type: 'image/jpeg' });

    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);
    mockUpload.mockResolvedValue({ error: null });

    const { uploadDishPhoto } = await import('@/lib/upload');
    const path = await uploadDishPhoto('dish-123', original, makeSupabase() as never);

    expect(imageCompression).toHaveBeenCalledWith(original, {
      maxSizeMB: 2,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    });
    expect(mockFrom).toHaveBeenCalledWith('dish-photos');
    expect(path).toBe('dish-photos/dish-123/hero.jpg');
  });

  it('throws when storage upload fails', async () => {
    const original = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const compressed = new File(['c'], 'photo.jpg', { type: 'image/jpeg' });
    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);
    mockUpload.mockResolvedValue({ error: new Error('storage error') });

    const { uploadDishPhoto } = await import('@/lib/upload');
    await expect(uploadDishPhoto('dish-xyz', original, makeSupabase() as never)).rejects.toThrow(
      'storage error'
    );
  });
});

// ─── uploadMenuScanPage ───────────────────────────────────────────────────────

describe('uploadMenuScanPage', () => {
  const FIXED_UUID = 'aaaabbbb-cccc-dddd-eeee-ffffffffffff';

  it('compresses the image and uploads to menu-scan-uploads/<restaurantId>/<uuid>.jpg', async () => {
    const original = new File(['data'], 'menu.jpg', { type: 'image/jpeg' });
    const compressed = new File(['compressed'], 'menu.jpg', { type: 'image/jpeg' });
    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      FIXED_UUID as `${string}-${string}-${string}-${string}-${string}`
    );
    mockUpload.mockResolvedValue({ error: null });

    const { uploadMenuScanPage } = await import('@/lib/upload');
    const result = await uploadMenuScanPage('rest-123', original, 1, makeSupabase() as never);

    expect(imageCompression).toHaveBeenCalledWith(original, {
      maxSizeMB: 2,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    });
    expect(mockFrom).toHaveBeenCalledWith('menu-scan-uploads');
    expect(mockUpload).toHaveBeenCalledWith(`rest-123/${FIXED_UUID}.jpg`, compressed, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    expect(result).toEqual({
      bucket: 'menu-scan-uploads',
      path: `rest-123/${FIXED_UUID}.jpg`,
      page: 1,
    });
  });

  it('passes page number through to the returned object', async () => {
    const original = new File(['data'], 'menu.jpg', { type: 'image/jpeg' });
    const compressed = new File(['c'], 'menu.jpg', { type: 'image/jpeg' });
    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      FIXED_UUID as `${string}-${string}-${string}-${string}-${string}`
    );
    mockUpload.mockResolvedValue({ error: null });

    const { uploadMenuScanPage } = await import('@/lib/upload');
    const result = await uploadMenuScanPage('rest-xyz', original, 3, makeSupabase() as never);

    expect(result.page).toBe(3);
    expect(result.bucket).toBe('menu-scan-uploads');
  });

  it('throws when storage upload returns an error', async () => {
    const original = new File(['data'], 'menu.jpg', { type: 'image/jpeg' });
    const compressed = new File(['c'], 'menu.jpg', { type: 'image/jpeg' });
    vi.mocked(imageCompression).mockResolvedValue(compressed as unknown as File);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      FIXED_UUID as `${string}-${string}-${string}-${string}-${string}`
    );
    mockUpload.mockResolvedValue({ error: new Error('upload failed') });

    const { uploadMenuScanPage } = await import('@/lib/upload');
    await expect(
      uploadMenuScanPage('rest-abc', original, 2, makeSupabase() as never)
    ).rejects.toThrow('upload failed');
  });
});
