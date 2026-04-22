'use client';

import { Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageCarousel } from './ImageCarousel';
import { RestaurantDetailsFormPanel } from './RestaurantDetailsFormPanel';
import { useReviewStore } from '../store';

export function ReviewLeftPanel() {
  const leftPanelTab = useReviewStore(s => s.leftPanelTab);
  const setLeftPanelTab = useReviewStore(s => s.setLeftPanelTab);
  const previewUrls = useReviewStore(s => s.previewUrls);
  const currentImageIdx = useReviewStore(s => s.currentImageIdx);
  const setCurrentImageIdx = useReviewStore(s => s.setCurrentImageIdx);
  const setLightboxOpen = useReviewStore(s => s.setLightboxOpen);
  const restaurantDetails = useReviewStore(s => s.restaurantDetails);
  const updateRestaurantDetails = useReviewStore(s => s.updateRestaurantDetails);

  return (
    <div className="w-80 shrink-0 flex flex-col bg-background rounded-xl border overflow-hidden">
      {/* Tab switcher */}
      <div className="flex border-b shrink-0">
        <button
          onClick={() => setLeftPanelTab('images')}
          className={cn(
            'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
            leftPanelTab === 'images'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          🖼️ Images
        </button>
        <button
          onClick={() => setLeftPanelTab('details')}
          className={cn(
            'flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
            leftPanelTab === 'details'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Store className="h-3 w-3" />
          Details
          {restaurantDetails.dirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary ml-0.5" />
          )}
        </button>
      </div>

      {leftPanelTab === 'images' && (
        <ImageCarousel
          previewUrls={previewUrls}
          currentImageIdx={currentImageIdx}
          setCurrentImageIdx={setCurrentImageIdx}
          setLightboxOpen={setLightboxOpen}
        />
      )}

      {leftPanelTab === 'details' && (
        <RestaurantDetailsFormPanel
          restaurantDetails={restaurantDetails}
          updateRestaurantDetails={updateRestaurantDetails}
        />
      )}
    </div>
  );
}
