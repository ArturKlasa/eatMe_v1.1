// ---------------------------------------------------------------------------
// Shared types for menu-scan hooks and components
// ---------------------------------------------------------------------------

export type Step = 'upload' | 'processing' | 'review' | 'done';

export interface RestaurantOption {
  id: string;
  name: string;
  city: string | null;
  country_code: string | null;
}

export interface DietaryTagOption {
  id: string;
  code: string;
  name: string;
}

export interface AddIngredientTarget {
  menuIdx: number;
  catIdx: number;
  dishIdx: number;
  rawText: string;
}

export interface ScanJob {
  /** Client-side tracking ID (assigned before API responds) */
  tempId: string;
  /** Database job ID (null until the API responds) */
  jobId: string | null;
  restaurantId: string;
  restaurantName: string;
  status: 'processing' | 'needs_review' | 'failed';
  result?: {
    currency: string;
    result: import('@/lib/menu-scan').EnrichedResult;
    flaggedDuplicates: import('@/lib/menu-scan').FlaggedDuplicate[];
    extractionNotes: import('@/lib/menu-scan').ExtractionNote[];
    dishCount: number;
  };
  imageStoragePaths?: string[];
  error?: string;
  startedAt: Date;
}

export interface RestaurantDetailsForm {
  address: string;
  city: string;
  neighbourhood: string;
  state: string;
  postal_code: string;
  country_code: string;
  phone: string;
  website: string;
  lat: number | null;
  lng: number | null;
  dirty: boolean;
}
