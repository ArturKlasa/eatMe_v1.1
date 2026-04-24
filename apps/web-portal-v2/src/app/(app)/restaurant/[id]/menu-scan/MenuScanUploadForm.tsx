'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/browser';
import { uploadMenuScanPage } from '@/lib/upload';
import { createMenuScanJob } from '../actions/menuScan';

interface Props {
  restaurantId: string;
}

type Phase = 'idle' | 'uploading' | 'creating' | 'error';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const ACCEPTED_EXT = /\.(jpe?g|png|heic|heif)$/i;

function isAccepted(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type) || ACCEPTED_EXT.test(file.name);
}

export function MenuScanUploadForm({ restaurantId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const accepted = Array.from(incoming).filter(isAccepted);
    setFiles(prev => [...prev, ...accepted].slice(0, 20));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleZoneKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setPhase('uploading');
    setErrorMessage(null);

    try {
      const images: { bucket: string; path: string; page: number }[] = [];

      for (let i = 0; i < files.length; i++) {
        const result = await uploadMenuScanPage(restaurantId, files[i], i + 1, supabase as never);
        images.push(result);
      }

      setPhase('creating');
      const result = await createMenuScanJob(restaurantId, { images });

      if (!result.ok) {
        setErrorMessage(result.formError ?? 'Failed to create scan job');
        setPhase('error');
        return;
      }

      router.push(`/restaurant/${restaurantId}/menu-scan/${result.data.jobId}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      setPhase('error');
    }
  };

  const isProcessing = phase === 'uploading' || phase === 'creating';

  return (
    <section aria-label="Upload menu images for AI scan">
      <h2 className="text-base font-medium mb-4">Upload menu images</h2>

      <div
        role="button"
        tabIndex={0}
        aria-label="Drop zone for menu images. Press Enter or Space to open file picker."
        aria-disabled={isProcessing}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={handleZoneKeyDown}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-sm transition-colors cursor-pointer select-none',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          isProcessing ? 'pointer-events-none opacity-50' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="font-medium">Drop images here or click to browse</p>
        <p className="text-muted-foreground text-xs">JPEG, PNG, HEIC — up to 20 pages</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.heic,.heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => addFiles(e.target.files)}
        disabled={isProcessing}
      />

      {files.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Selected files">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
            >
              <span className="truncate max-w-xs">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label={`Remove ${file.name}`}
                className="text-muted-foreground hover:text-destructive ml-2 shrink-0"
                disabled={isProcessing}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {phase === 'error' && errorMessage && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {isProcessing && (
        <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
          {phase === 'uploading' && 'Uploading images…'}
          {phase === 'creating' && 'Creating scan job…'}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={files.length === 0 || isProcessing}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isProcessing
          ? 'Processing…'
          : `Scan ${files.length} image${files.length !== 1 ? 's' : ''}`}
      </button>
    </section>
  );
}
