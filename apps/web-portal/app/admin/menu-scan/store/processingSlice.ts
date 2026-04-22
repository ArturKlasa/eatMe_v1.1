import { StateCreator } from 'zustand';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { resizeImageToBase64 } from '@/lib/menu-scan-utils';
import type { FireResult } from '../hooks/useProcessingState';
import type { UploadSlice } from './uploadSlice';

export interface ProcessingSlice {
  fireProcess: () => Promise<FireResult | null>;
}

export const createProcessingSlice: StateCreator<
  UploadSlice & ProcessingSlice & any, // eslint-disable-line @typescript-eslint/no-explicit-any
  [],
  [],
  ProcessingSlice
> = (_set, get) => ({
  fireProcess: async () => {
    const { selectedRestaurant, imageFiles, isPdfConverting } = get() as UploadSlice;

    if (!selectedRestaurant) {
      toast.error('Please select a restaurant');
      return null;
    }
    if (imageFiles.length === 0) {
      toast.error('Please upload at least one image or PDF');
      return null;
    }
    if (isPdfConverting) {
      toast.error('PDF is still converting — please wait a moment');
      return null;
    }

    const restaurant = selectedRestaurant;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired — please reload');

      toast.info('Resizing images...');
      const resized = await Promise.all(imageFiles.map(f => resizeImageToBase64(f)));

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
  },
});
