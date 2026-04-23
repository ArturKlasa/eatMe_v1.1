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
