'use client';

import { AddIngredientPanel } from '@/components/admin/AddIngredientPanel';
import { useReviewStore } from '../store';
import { ReviewHeader } from './ReviewHeader';
import { ReviewLeftPanel } from './ReviewLeftPanel';
import { PageGroupedList } from './PageGroupedList';
import { ImageZoomLightbox } from './ImageZoomLightbox';
import { UndoToast } from './UndoToast';

export function MenuScanReview({ jobId: _jobId }: { jobId: string }) {
  const addIngredientTarget = useReviewStore(s => s.addIngredientTarget);
  const setAddIngredientTarget = useReviewStore(s => s.setAddIngredientTarget);
  const resolveIngredient = useReviewStore(s => s.resolveIngredient);
  const lightboxOpen = useReviewStore(s => s.lightboxOpen);
  const setLightboxOpen = useReviewStore(s => s.setLightboxOpen);
  const previewUrls = useReviewStore(s => s.previewUrls);
  const currentImageIdx = useReviewStore(s => s.currentImageIdx);
  const setCurrentImageIdx = useReviewStore(s => s.setCurrentImageIdx);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <ReviewHeader />

      <div className="flex gap-5 min-h-0 flex-1">
        <ReviewLeftPanel />
        <PageGroupedList />
      </div>

      <ImageZoomLightbox
        lightboxOpen={lightboxOpen}
        setLightboxOpen={setLightboxOpen}
        previewUrls={previewUrls}
        currentImageIdx={currentImageIdx}
        setCurrentImageIdx={setCurrentImageIdx}
      />

      {addIngredientTarget && (
        <AddIngredientPanel
          rawText={addIngredientTarget.rawText}
          onSuccess={resolved => {
            resolveIngredient(
              addIngredientTarget.menuIdx,
              addIngredientTarget.catIdx,
              addIngredientTarget.dishIdx,
              addIngredientTarget.rawText,
              resolved
            );
            setAddIngredientTarget(null);
          }}
          onClose={() => setAddIngredientTarget(null)}
        />
      )}

      <UndoToast />
    </div>
  );
}
