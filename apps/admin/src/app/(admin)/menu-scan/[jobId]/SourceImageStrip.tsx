'use client';

import { useEffect, useState } from 'react';
import type { MenuScanImageUrl } from '@/lib/auth/dal';

interface Props {
  images: MenuScanImageUrl[];
  // source_image_index → number of dishes the AI extracted from that page.
  // Computed by AdminJobShell from result_json.dishes. Pages with 0 dishes
  // get a yellow "0 extracted" badge — that's the diagnostic that surfaces
  // partial-extraction failures (the page that needs re-scanning).
  dishCountsByIndex: Map<number, number>;
}

export function SourceImageStrip({ images, dishCountsByIndex }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Esc closes the lightbox. Window listener so it works regardless of focus.
  useEffect(() => {
    if (!lightboxUrl) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxUrl(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxUrl]);

  if (images.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No source images recorded for this job (likely a pre-migration-118 row).
      </p>
    );
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {images.map((img, idx) => {
          // source_image_index is 0-based array position; img.page is 1-based
          // upload order. They line up in practice but we key the count map
          // off idx since that's what the worker / AI use.
          const dishCount = dishCountsByIndex.get(idx) ?? 0;
          const tone =
            dishCount === 0
              ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-900/40'
              : 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-900/40';
          return (
            <button
              key={img.path}
              type="button"
              onClick={() => setLightboxUrl(img.url)}
              className="shrink-0 flex flex-col items-center gap-1 group focus:outline-none"
              aria-label={`View page ${img.page} (${dishCount} dishes extracted)`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Menu scan page ${img.page}`}
                className="h-32 w-auto rounded border border-border bg-muted object-contain group-hover:border-primary/50 group-focus:border-primary"
                loading="lazy"
              />
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-medium text-muted-foreground">pg {img.page}</span>
                <span
                  className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}
                  title={
                    dishCount === 0
                      ? 'No dishes extracted from this page — likely a partial-scan failure'
                      : `${dishCount} dish${dishCount === 1 ? '' : 'es'} extracted`
                  }
                >
                  {dishCount} dish{dishCount === 1 ? '' : 'es'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Source page (full size)"
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Menu scan page (full size)"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </>
  );
}
