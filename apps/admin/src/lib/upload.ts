'use client';

export async function compressImage(file: File): Promise<File> {
  const imageCompression = (await import('browser-image-compression')).default;
  // 4096px / 6MB (raised from 2048 / 2 on 2026-06-09): menu text is small — at
  // 2048px a dish line is ~15px tall and the scan model substitutes plausible
  // words instead of reading. The worker requests detail:'original' (≤6000px),
  // so resolution kept here is resolution the model actually uses. 6MB ≈ 8MB
  // as base64, well under OpenAI's 20MB-per-image cap.
  return imageCompression(file, {
    maxSizeMB: 6,
    maxWidthOrHeight: 4096,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  });
}

// Below this long side (typical of chat-app screenshots) the scan model
// hallucinates word substitutions long before it fails outright. Used for a
// pre-scan warning only — never blocks the upload.
export const LOW_RES_LONG_SIDE_PX = 1500;

// Long side of the original (pre-compression) image, or null when the browser
// can't decode the file (the upload itself will surface a real error then).
export async function imageLongestSide(file: File): Promise<number | null> {
  try {
    const bmp = await createImageBitmap(file);
    const side = Math.max(bmp.width, bmp.height);
    bmp.close();
    return side;
  } catch {
    return null;
  }
}

// Stable identity for a selected file across the upload forms' state.
export function lowResKey(file: File): string {
  return `${file.name}:${file.size}`;
}

// Measure a batch of just-added files and return lowResKey → long-side px for
// those under the threshold. Empty map = nothing to warn about.
export async function findLowResFiles(files: File[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const f of files) {
    const side = await imageLongestSide(f);
    if (side != null && side < LOW_RES_LONG_SIDE_PX) {
      out.set(lowResKey(f), side);
    }
  }
  return out;
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
