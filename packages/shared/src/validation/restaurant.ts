import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '../logic/currency';

export const basicInfoSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .optional()
    .or(z.literal('')),

  address: z.string().min(5, 'Please enter a valid address'),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number (e.g., +1234567890)')
    .optional()
    .or(z.literal('')),

  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  cuisines: z.array(z.string()).min(1, 'Please select at least one cuisine'),
});

/** HH:MM time string used for individual day open/close hours. */
const timeSchema = z.object({
  open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
});

export const operationsSchema = z.object({
  operating_hours: z.object({
    monday: timeSchema.optional(),
    tuesday: timeSchema.optional(),
    wednesday: timeSchema.optional(),
    thursday: timeSchema.optional(),
    friday: timeSchema.optional(),
    saturday: timeSchema.optional(),
    sunday: timeSchema.optional(),
  }),
  delivery_available: z.boolean(),
  takeout_available: z.boolean(),
  dine_in_available: z.boolean(),
  accepts_reservations: z.boolean(),
});

export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
export type OperationsFormData = z.infer<typeof operationsSchema>;

/** Basic-info step schema — shared by the Server Action and BasicInfoForm.
 *  No .default() on any field so zodResolver + useForm<z.infer<>> stays type-clean. */
export const restaurantBasicsSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  description: z.string().optional().or(z.literal('')),
  restaurant_type: z.string().optional().or(z.literal('')),
  /** Legacy free-text field. New admin form writes `country_code` instead; this stays for the v2 owner-portal compatibility. */
  country: z.string().optional().or(z.literal('')),
  /** ISO 3166-1 alpha-2 (e.g. "MX", "PL"). New canonical field; mirrors restaurants.country_code in DB. */
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/, 'Country code must be ISO alpha-2 (e.g. MX)')
    .optional()
    .or(z.literal('')),
  /** ISO 4217 currency code (e.g. "MXN", "PLN"). Mirrors restaurants.currency_code in DB. */
  currency_code: z.enum(SUPPORTED_CURRENCIES).optional(),
  city: z.string().optional().or(z.literal('')),
  postal_code: z.string().optional().or(z.literal('')),
  neighbourhood: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  cuisines: z.array(z.string()).optional(),
});

export type RestaurantBasicsInput = z.infer<typeof restaurantBasicsSchema>;

/** Draft-state CRUD schema: name required; all other fields optional but validated when present. */
export const restaurantDraftSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  description: z.string().optional().or(z.literal('')),
  restaurant_type: z.string().optional(),
  country: z.string().optional(),
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/, 'Country code must be ISO alpha-2 (e.g. MX)')
    .optional()
    .or(z.literal('')),
  currency_code: z.enum(SUPPORTED_CURRENCIES).optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  neighbourhood: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional().or(z.literal('')),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  cuisines: z.array(z.string()).default([]),
  operating_hours: z
    .object({
      monday: z.object({ open: z.string(), close: z.string() }).optional(),
      tuesday: z.object({ open: z.string(), close: z.string() }).optional(),
      wednesday: z.object({ open: z.string(), close: z.string() }).optional(),
      thursday: z.object({ open: z.string(), close: z.string() }).optional(),
      friday: z.object({ open: z.string(), close: z.string() }).optional(),
      saturday: z.object({ open: z.string(), close: z.string() }).optional(),
      sunday: z.object({ open: z.string(), close: z.string() }).optional(),
    })
    .optional(),
  delivery_available: z.boolean().default(false),
  takeout_available: z.boolean().default(false),
  dine_in_available: z.boolean().default(false),
  accepts_reservations: z.boolean().default(false),
});

export type RestaurantDraftFormData = z.infer<typeof restaurantDraftSchema>;

/** Stricter schema for publish-ready restaurants — all required fields must be present. */
export const restaurantPublishableSchema = basicInfoSchema.merge(operationsSchema);

export type RestaurantPublishableFormData = z.infer<typeof restaurantPublishableSchema>;

// ─── Step 16: Location + Hours schemas ──────────────────────────────────────

export const restaurantLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(5, 'Please enter a valid address'),
});
export type RestaurantLocationInput = z.infer<typeof restaurantLocationSchema>;

const dayHoursSchema = z.object({
  open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time (HH:MM)'),
  close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time (HH:MM)'),
});

export const restaurantHoursSchema = z.object({
  operating_hours: z.object({
    monday: dayHoursSchema.optional(),
    tuesday: dayHoursSchema.optional(),
    wednesday: dayHoursSchema.optional(),
    thursday: dayHoursSchema.optional(),
    friday: dayHoursSchema.optional(),
    saturday: dayHoursSchema.optional(),
    sunday: dayHoursSchema.optional(),
  }),
  delivery_available: z.boolean(),
  takeout_available: z.boolean(),
  dine_in_available: z.boolean(),
  accepts_reservations: z.boolean(),
});
export type RestaurantHoursInput = z.infer<typeof restaurantHoursSchema>;
