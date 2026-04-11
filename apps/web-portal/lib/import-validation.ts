import { z } from 'zod';
import { RESTAURANT_TYPES, CUISINES, COUNTRIES } from '@/lib/constants';
import type { MappedRestaurant, ValidationResult, ImportError } from '@/lib/import-types';

const VALID_RESTAURANT_TYPES: string[] = RESTAURANT_TYPES.map((t) => t.value);
const VALID_COUNTRY_CODES: string[] = COUNTRIES.map((c) => c.value);
const VALID_CUISINES: string[] = CUISINES as unknown as string[];

const mappedRestaurantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  latitude: z
    .number()
    .min(-90, 'Latitude must be >= -90')
    .max(90, 'Latitude must be <= 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be >= -180')
    .max(180, 'Longitude must be <= 180'),
  phone: z.string().optional(),
  website: z.string().optional(),
  restaurant_type: z.string(),
  cuisine_types: z.array(z.string()),
  country_code: z.string(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  neighbourhood: z.string().optional(),
  open_hours: z.record(z.string(), z.object({ open: z.string(), close: z.string() })).optional(),
  delivery_available: z.boolean().optional(),
  takeout_available: z.boolean().optional(),
  dine_in_available: z.boolean().optional(),
  accepts_reservations: z.boolean().optional(),
  payment_methods: z.string().optional(),
  google_place_id: z.string().optional(),
});

/**
 * Validates a MappedRestaurant and returns a sanitized version with defaults applied.
 * - Falls back to "restaurant" for unknown restaurant_type values.
 * - Falls back to "MX" for unknown or missing country_code.
 * - Filters cuisine_types to only known values.
 * - Empty cuisine_types passes validation but will be flagged as missing_cuisine.
 */
export function validateImportedRestaurant(r: MappedRestaurant): ValidationResult {
  const errors: ImportError[] = [];

  const result = mappedRestaurantSchema.safeParse(r);
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      errors.push({
        index: 0,
        field: issue.path.join('.'),
        message: issue.message,
      });
    });
  }

  // If core fields (name, lat, lng) fail, return invalid immediately
  const nameValid = typeof r.name === 'string' && r.name.trim().length > 0;
  const latValid = typeof r.latitude === 'number' && r.latitude >= -90 && r.latitude <= 90;
  const lngValid = typeof r.longitude === 'number' && r.longitude >= -180 && r.longitude <= 180;

  if (!nameValid || !latValid || !lngValid) {
    return {
      valid: false,
      errors,
      sanitized: r,
    };
  }

  // Apply defaults and sanitize
  const sanitized: MappedRestaurant = {
    ...r,
    name: r.name.trim(),
    restaurant_type: VALID_RESTAURANT_TYPES.includes(r.restaurant_type)
      ? r.restaurant_type
      : 'restaurant',
    country_code: VALID_COUNTRY_CODES.includes(r.country_code) ? r.country_code : 'MX',
    cuisine_types: Array.isArray(r.cuisine_types)
      ? r.cuisine_types.filter((c) => VALID_CUISINES.includes(c))
      : [],
  };

  return {
    valid: true,
    errors,
    sanitized,
  };
}
