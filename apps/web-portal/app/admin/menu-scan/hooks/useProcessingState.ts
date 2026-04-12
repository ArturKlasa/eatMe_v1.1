'use client';

import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { resizeImageToBase64 } from '@/lib/menu-scan-utils';
import type { RestaurantOption } from './menuScanTypes';

interface ProcessingDeps {
  selectedRestaurant: RestaurantOption | null;
  imageFiles: File[];
  isPdfConverting: boolean;
}

export interface FireResult {
  restaurantId: string;
  restaurantName: string;
  fetchPromise: Promise<Response>;
}

/**
 * Manages processing-phase logic.
 * Returns a fire-and-forget launcher instead of blocking the UI.
 */
export function useProcessingState(deps: ProcessingDeps) {
  /**
   * Validates inputs, resizes images, and fires the API request.
   * Returns a FireResult with the fetch promise, or null if validation fails.
   * Does NOT await the response — the caller is responsible for tracking completion.
   */
  const fireProcess = async (): Promise<FireResult | null> => {
    if (!deps.selectedRestaurant) {
      toast.error('Please select a restaurant');
      return null;
    }
    if (deps.imageFiles.length === 0) {
      toast.error('Please upload at least one image or PDF');
      return null;
    }
    if (deps.isPdfConverting) {
      toast.error('PDF is still converting — please wait a moment');
      return null;
    }

    const restaurant = deps.selectedRestaurant;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired — please reload');

      toast.info('Resizing images...');
      const resized = await Promise.all(deps.imageFiles.map(f => resizeImageToBase64(f)));

      toast.info(`Sending ${resized.length} image(s) to AI...`);

      const fetchPromise = fetch('/api/menu-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          images: resized,
        }),
      });

      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        fetchPromise,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(msg);
      return null;
    }
  };

  return { fireProcess };
}
