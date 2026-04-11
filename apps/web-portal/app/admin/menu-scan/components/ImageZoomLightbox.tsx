'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface ImageZoomLightboxProps {
  lightboxOpen: boolean;
  setLightboxOpen: (v: boolean) => void;
  previewUrls: string[];
  currentImageIdx: number;
  setCurrentImageIdx: (v: number | ((prev: number) => number)) => void;
}

export function ImageZoomLightbox({
  lightboxOpen,
  setLightboxOpen,
  previewUrls,
  currentImageIdx,
  setCurrentImageIdx,
}: ImageZoomLightboxProps) {
  if (!lightboxOpen || previewUrls.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={() => setLightboxOpen(false)}
    >
      <button
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
        onClick={() => setLightboxOpen(false)}
      >
        <X className="h-6 w-6" />
      </button>
      {previewUrls.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-3 hover:bg-white/10 rounded-full disabled:opacity-30 transition-colors"
            onClick={e => {
              e.stopPropagation();
              setCurrentImageIdx(i => Math.max(0, i - 1));
            }}
            disabled={currentImageIdx === 0}
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-3 hover:bg-white/10 rounded-full disabled:opacity-30 transition-colors"
            onClick={e => {
              e.stopPropagation();
              setCurrentImageIdx(i => Math.min(previewUrls.length - 1, i + 1));
            }}
            disabled={currentImageIdx === previewUrls.length - 1}
          >
            <ChevronRight className="h-8 w-8" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {currentImageIdx + 1} / {previewUrls.length}
          </div>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrls[currentImageIdx]}
        alt="Menu zoom"
        className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}
