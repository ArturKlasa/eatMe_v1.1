'use client';

export async function compressImage(file: File): Promise<File> {
  const imageCompression = (await import('browser-image-compression')).default;
  return imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  });
}

export type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File,
        options: { contentType: string; upsert: boolean }
      ) => Promise<{ error: unknown }>;
    };
  };
};

export async function uploadMenuScanPage(
  restaurantId: string,
  file: File,
  pageNumber: number,
  supabase: StorageClient
): Promise<{ bucket: 'menu-scan-uploads'; path: string; page: number }> {
  const compressed = await compressImage(file);
  const uuid = crypto.randomUUID();
  const storagePath = `${restaurantId}/${uuid}.jpg`;
  const { error } = await supabase.storage
    .from('menu-scan-uploads')
    .upload(storagePath, compressed, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return { bucket: 'menu-scan-uploads', path: storagePath, page: pageNumber };
}
