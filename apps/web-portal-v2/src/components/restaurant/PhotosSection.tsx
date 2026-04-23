'use client';

import { useState, useRef } from 'react';
import { createBrowserClient } from '@eatme/database/web';
import { compressImage, uploadCompressedRestaurantPhoto } from '@/lib/upload';
import { updateRestaurantPhoto } from '@/app/(app)/restaurant/[id]/actions/restaurant';

interface Props {
  restaurantId: string;
  initialImageUrl?: string | null;
  onValidChange?: (valid: boolean) => void;
}

type UploadState = 'idle' | 'compressing' | 'uploading' | 'saving' | 'done' | 'error';

export function PhotosSection({ restaurantId, initialImageUrl, onValidChange }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl ?? null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    setUploadState('compressing');
    setProgress('Compressing image...');

    try {
      // First await: React 18 flushes the 'compressing' state here — user sees it during compression
      const compressed = await compressImage(file);

      setUploadState('uploading');
      setProgress('Uploading...');
      const path = await uploadCompressedRestaurantPhoto(restaurantId, compressed, supabase);

      setUploadState('saving');
      setProgress('Saving...');
      const result = await updateRestaurantPhoto(restaurantId, path);

      if (!result.ok) {
        setUploadState('error');
        setErrorMsg(result.formError ?? 'Failed to save photo');
        onValidChange?.(false);
        return;
      }

      // Build a public URL for preview (storage bucket must be public or signed)
      const { data: publicData } = supabase.storage.from('restaurant-photos').getPublicUrl(path);
      setImageUrl(publicData.publicUrl ?? path);
      setUploadState('done');
      setProgress('Photo uploaded.');
      onValidChange?.(true);
      setTimeout(() => setProgress(''), 3000);
    } catch (err) {
      setUploadState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
      onValidChange?.(false);
    }
  }

  const isLoading = ['compressing', 'uploading', 'saving'].includes(uploadState);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Step 5: Hero Photo</h2>
        <div>
          {progress && (
            <span
              className={`text-sm ${uploadState === 'error' ? 'text-red-600' : uploadState === 'done' ? 'text-green-600' : 'text-muted-foreground'}`}
            >
              {progress}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Upload a hero photo for your restaurant. JPEG, PNG or WebP. Max 2 MB after compression.
      </p>

      {imageUrl && (
        <div className="rounded-md overflow-hidden border border-border w-full max-w-sm aspect-video bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Restaurant hero" className="w-full h-full object-cover" />
        </div>
      )}

      {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="px-4 py-2 rounded-md border border-border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
        >
          {isLoading ? progress : imageUrl ? 'Replace photo' : 'Upload photo'}
        </button>
      </div>
    </div>
  );
}
