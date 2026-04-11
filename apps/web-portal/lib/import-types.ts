/**
 * Shared types for the restaurant data ingestion system.
 * Used by both the Google Places and CSV import paths.
 */

export interface MappedRestaurant {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  restaurant_type: string;
  cuisine_types: string[];
  country_code: string;
  city?: string;
  state?: string;
  postal_code?: string;
  neighbourhood?: string;
  open_hours?: Record<string, { open: string; close: string }>;
  delivery_available?: boolean;
  takeout_available?: boolean;
  dine_in_available?: boolean;
  accepts_reservations?: boolean;
  payment_methods?: string;
  google_place_id?: string;
}

export type WarningFlag =
  | 'missing_cuisine'
  | 'missing_hours'
  | 'missing_contact'
  | 'missing_menu'
  | 'possible_duplicate';

export interface ImportSummary {
  jobId: string;
  source: 'google_places' | 'csv';
  inserted: number;
  skipped: number;
  flagged: number;
  errors: ImportError[];
  restaurants: ImportedRestaurantSummary[];
  apiCallsUsed: number;
  estimatedCostUsd: number;
}

export interface ImportedRestaurantSummary {
  id: string;
  name: string;
  address: string;
  warnings: WarningFlag[];
  skipped: boolean;
  skipReason?: string;
  /** Set when the DB insert failed for this row. */
  error?: string;
}

export interface ImportError {
  index: number;
  field?: string;
  message: string;
}

export interface SkippedRestaurant {
  name: string;
  google_place_id?: string;
  reason: 'exact_duplicate' | 'validation_error';
  existingId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ImportError[];
  sanitized: MappedRestaurant;
}
