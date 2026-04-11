'use client';

import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

export interface ImageCarouselProps {
  previewUrls: string[];
  currentImageIdx: number;
  setCurrentImageIdx: (v: number | ((prev: number) => number)) => void;
  setLightboxOpen: (v: boolean) => void;
}

export function ImageCarousel({
  previewUrls,
  currentImageIdx,
  setCurrentImageIdx,
  setLightboxOpen,
}: ImageCarouselProps) {
  return (
    <>
      <div
        className="flex-1 overflow-hidden bg-muted/30 flex items-center justify-center relative min-h-0 cursor-zoom-in group"
        onClick={() => previewUrls.length > 0 && setLightboxOpen(true)}
      >
        {previewUrls.length > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrls[currentImageIdx]}
              alt={`Page ${currentImageIdx + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="bg-black/50 text-white p-1.5 rounded-lg hover:bg-black/70"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No preview</p>
        )}
      </div>
      {previewUrls.length > 1 ? (
        <div className="flex items-center justify-between p-3 border-t shrink-0">
          <button
            onClick={() => setCurrentImageIdx(i => Math.max(0, i - 1))}
            disabled={currentImageIdx === 0}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground font-medium">
            Page {currentImageIdx + 1} / {previewUrls.length}
          </span>
          <button
            onClick={() => setCurrentImageIdx(i => Math.min(previewUrls.length - 1, i + 1))}
            disabled={currentImageIdx === previewUrls.length - 1}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="p-2.5 border-t text-center shrink-0">
          <button
            onClick={() => setLightboxOpen(true)}
            className="text-xs text-muted-foreground hover:text-brand-primary flex items-center gap-1 mx-auto"
          >
            <ZoomIn className="h-3 w-3" /> Click image to zoom
          </button>
        </div>
      )}
    </>
  );
}
