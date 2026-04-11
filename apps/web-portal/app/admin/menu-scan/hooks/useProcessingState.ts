'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { type EnrichedResult, toEditableMenus, type EditableMenu, type FlaggedDuplicate } from '@/lib/menu-scan';
import { resizeImageToBase64 } from '@/lib/menu-scan-utils';
import type { RestaurantOption, RestaurantDetailsForm, Step } from './menuScanTypes';

interface ProcessingDeps {
  selectedRestaurant: RestaurantOption | null;
  imageFiles: File[];
  isPdfConverting: boolean;
  setStep: (step: Step) => void;
  /** Called before API request — resets review state for the selected restaurant */
  onProcessingStart: (restaurant: RestaurantOption) => void;
  /** Called on successful processing — passes extracted data to review/group state */
  onProcessingResult: (result: {
    jobId: string;
    currency: string;
    menus: EditableMenu[];
    autoExpanded: Set<string>;
    flaggedDuplicates: FlaggedDuplicate[];
  }) => void;
}

/** Manages processing-phase state: image resizing, API calls, orchestration */
export function useProcessingState(deps: ProcessingDeps) {
  const [processingError, setProcessingError] = useState('');
  const [processingStage, setProcessingStage] = useState<'resizing' | 'sending' | 'analyzing'>(
    'resizing'
  );

  const handleProcess = async () => {
    if (!deps.selectedRestaurant) {
      toast.error('Please select a restaurant');
      return;
    }
    if (deps.imageFiles.length === 0) {
      toast.error('Please upload at least one image or PDF');
      return;
    }
    if (deps.isPdfConverting) {
      toast.error('PDF is still converting — please wait a moment');
      return;
    }

    setProcessingError('');
    deps.onProcessingStart(deps.selectedRestaurant);
    deps.setStep('processing');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired — please reload');

      setProcessingStage('resizing');
      toast.info('Resizing images...');
      const resized = await Promise.all(deps.imageFiles.map(f => resizeImageToBase64(f)));

      setProcessingStage('sending');
      toast.info(`Sending ${resized.length} image(s) to AI...`);
      setProcessingStage('analyzing');
      const response = await fetch('/api/menu-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          restaurant_id: deps.selectedRestaurant.id,
          images: resized,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'AI processing failed');

      const enriched: EnrichedResult = data.result;
      const menus = toEditableMenus(enriched);

      const autoExpanded = new Set<string>();
      menus.forEach(menu =>
        menu.categories.forEach(cat =>
          cat.dishes.forEach(dish => {
            if (dish.confidence < 0.7) autoExpanded.add(dish._id);
          })
        )
      );

      deps.onProcessingResult({
        jobId: data.jobId,
        currency: data.currency ?? 'USD',
        menus,
        autoExpanded,
        flaggedDuplicates: data.flaggedDuplicates ?? [],
      });
      deps.setStep('review');
      toast.success(`Extracted ${data.dishCount} dishes — please review`);
    } catch (err: unknown) {
      console.error('[MenuScan] Processing error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setProcessingError(msg);
      deps.setStep('upload');
      toast.error(msg);
    }
  };

  return {
    processingError,
    setProcessingError,
    processingStage,
    handleProcess,
  };
}
