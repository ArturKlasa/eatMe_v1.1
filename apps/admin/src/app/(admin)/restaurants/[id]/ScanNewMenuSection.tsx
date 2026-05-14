'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/browser';
import { uploadMenuScanPage, type StorageClient } from '@/lib/upload';
import { adminCreateMenuScanJob } from '../../menu-scan/actions/menuScan';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const ACCEPTED_EXT = /\.(jpe?g|png|pdf)$/i;

function isAccepted(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type) || ACCEPTED_EXT.test(file.name);
}

async function rasterisePdf(file: File): Promise<File[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: File[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx as unknown as any, viewport, canvas }).promise;

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    if (!blob) continue;

    const pageName = `${file.name.replace(/\.pdf$/i, '')}-page-${pageNum}.jpg`;
    pages.push(new File([blob], pageName, { type: 'image/jpeg' }));
  }

  return pages;
}

interface Props {
  restaurantId: string;
  restaurantName: string;
}

export function ScanNewMenuSection({ restaurantId, restaurantName }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'creating' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (incoming: FileList | null) => {
    if (!incoming) return;
    const filesArray = Array.from(incoming);
    const collected: File[] = [];

    for (const f of filesArray) {
      if (!isAccepted(f)) continue;
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        setPdfLoading(true);
        try {
          const rasterised = await rasterisePdf(f);
          collected.push(...rasterised);
        } catch (err) {
          console.error('PDF rasterisation failed', err);
        } finally {
          setPdfLoading(false);
        }
      } else {
        collected.push(f);
      }
    }

    setFiles(prev => [...prev, ...collected].slice(0, 20));
  }, []);

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setPhase('uploading');
    setError(null);

    try {
      const images: { bucket: 'menu-scan-uploads'; path: string; page: number }[] = [];
      for (let i = 0; i < files.length; i++) {
        const result = await uploadMenuScanPage(
          restaurantId,
          files[i],
          i + 1,
          supabase as unknown as StorageClient
        );
        images.push(result);
      }

      setPhase('creating');
      const result = await adminCreateMenuScanJob(restaurantId, { images });

      if (!result.ok) {
        setError(result.formError ?? 'Failed to create scan job');
        setPhase('error');
        return;
      }

      router.push(`/menu-scan/${result.data.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPhase('error');
    }
  };

  const isProcessing = phase === 'uploading' || phase === 'creating';

  return (
    <section className="rounded-lg border border-border p-4 space-y-3">
      <div className="space-y-1">
        <h2 className="font-semibold text-sm">Scan another menu</h2>
        <p className="text-xs text-muted-foreground">
          Upload menu images for{' '}
          <span className="font-medium text-foreground">{restaurantName}</span>. Extracted dishes
          will be created as drafts you can review and publish.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Drop zone for menu files. Press Enter or Space to open file picker."
        aria-disabled={isProcessing}
        onDrop={e => {
          e.preventDefault();
          if (!isProcessing) void handleFiles(e.dataTransfer.files);
        }}
        onDragOver={e => e.preventDefault()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors cursor-pointer select-none',
          isProcessing ? 'pointer-events-none opacity-50' : 'border-border hover:border-primary/50',
        ].join(' ')}
      >
        <p className="font-medium">Drop files here or click to browse</p>
        <p className="text-muted-foreground text-xs">JPEG, PNG, PDF — up to 20 pages total</p>
        {pdfLoading && (
          <p className="text-xs text-muted-foreground animate-pulse">Rasterising PDF…</p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => void handleFiles(e.target.files)}
        disabled={isProcessing}
      />

      {files.length > 0 && (
        <ul className="space-y-1" aria-label="Selected files">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs"
            >
              <span className="truncate flex-1">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${f.name}`}
                className="text-muted-foreground hover:text-destructive shrink-0"
                disabled={isProcessing}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {phase === 'error' && error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {isProcessing && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {phase === 'uploading' ? 'Uploading images…' : 'Creating scan job…'}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={files.length === 0 || isProcessing}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isProcessing
            ? 'Processing…'
            : `Scan ${files.length} file${files.length !== 1 ? 's' : ''}`}
        </button>
        {files.length > 0 && !isProcessing && (
          <button
            type="button"
            onClick={() => setFiles([])}
            className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>
    </section>
  );
}
