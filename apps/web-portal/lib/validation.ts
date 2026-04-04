/**
 * Zod validation schemas for the restaurant partner onboarding wizard.
 *
 * Each schema corresponds to one step of the multi-page form:
 *   basicInfoSchema    — Step 1: restaurant identity, address, cuisines
 *   operationsSchema   — Step 1 (cont.): hours, services, payment
 *   dishSchema         — Step 2: individual dish definition
 *   menuSchema         — Step 2 (wrapper): full menu submitted at once
 *   restaurantDataSchema — Final review payload: restaurant + dishes merged
 *
 * The inferred TypeScript types (exported at the bottom) are used as the
 * form data types for React Hook Form throughout the onboarding pages.
 */
import { z } from 'zod';

/**
 * Basic restaurant identity and location information.
 * Submitted on the /onboard/basic-info page.
 */
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

/**
 * Restaurant operating details submitted alongside basicInfoSchema.
 * Each weekday in operating_hours is optional — omitting a day means closed.
 */
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

/**
 * Single dish definition.
 * Used both for the dish editor inside the onboarding wizard and for later
 * dish-edit flows in the restaurant dashboard.
 *
 * Notes:
 *  - `price` is validated positive and capped at 10,000 to catch obvious data
 *    entry mistakes, not to enforce a hard business rule.
 *  - `calories` accepts NaN (via `.or(z.nan())`) because RHF number inputs
 *    return NaN for an empty field.
 *  - `dietary_tags` and `allergens` are auto-populated by a Postgres trigger
 *    when ingredient links are saved; the arrays on this schema are the UI
 *    state before the dish is persisted.
 *  - `option_groups` holds customisation groups (size, sauce, etc.) for
 *    template and experience dish kinds.
 */
export const dishSchema = z.object({
  id: z.string().optional(),
  menu_id: z.string().optional(),
  dish_category_id: z.string().uuid('Invalid category').nullable().optional(),
  name: z.string().min(2, 'Dish name must be at least 2 characters'),
  description: z.string().optional().or(z.literal('')),
  price: z
    .number()
    .positive('Price must be greater than 0')
    .max(10000, 'Price seems unreasonably high'),
  calories: z.number().min(0).max(5000).optional().or(z.nan()),
  dietary_tags: z.array(z.string()),
  allergens: z.array(z.string()),
  spice_level: z.enum(['none', 'mild', 'hot']).optional().nullable(),
  photo_url: z.string().optional(),
  is_available: z.boolean().optional(),
  description_visibility: z.enum(['menu', 'detail']).optional(),
  ingredients_visibility: z.enum(['menu', 'detail', 'none']).optional(),
  dish_kind: z.enum(['standard', 'template', 'experience']).default('standard'),
  display_price_prefix: z
    .enum(['exact', 'from', 'per_person', 'market_price', 'ask_server'])
    .default('exact'),
  option_groups: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, 'Group name is required'),
        description: z.string().optional(),
        selection_type: z.enum(['single', 'multiple', 'quantity']),
        min_selections: z.number().int().min(0).default(0),
        max_selections: z.number().int().min(1).nullable().optional(),
        display_order: z.number().int().min(0).default(0),
        is_active: z.boolean().default(true),
        options: z.array(
          z.object({
            id: z.string().optional(),
            name: z.string().min(1, 'Option name is required'),
            description: z.string().optional(),
            price_delta: z.number().default(0),
            calories_delta: z.number().int().nullable().optional(),
            canonical_ingredient_id: z.string().uuid().nullable().optional(),
            is_available: z.boolean().default(true),
            display_order: z.number().int().min(0).default(0),
          })
        ),
      })
    )
    .optional()
    .default([]),
});

/** Wrapper schema that validates the full menu submitted on /onboard/menu. */
export const menuSchema = z.object({
  dishes: z.array(dishSchema).min(1, 'Please add at least one dish'),
});

/**
 * Full submission payload used on the /onboard/review page.
 * Merges basicInfoSchema and operationsSchema into a single restaurant object
 * alongside the array of dishes, so the entire restaurant can be persisted
 * in one atomic operation.
 */
export const restaurantDataSchema = z.object({
  restaurant: basicInfoSchema.merge(operationsSchema),
  dishes: z.array(dishSchema).min(1, 'Please add at least one dish'),
});

// ─── Inferred TypeScript types ──────────────────────────────────────────────
// These are the canonical form-data types used with React Hook Form across the
// onboarding wizard. Always derive from the schema to keep validation and types in sync.

export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
export type OperationsFormData = z.infer<typeof operationsSchema>;
export type DishFormData = z.infer<typeof dishSchema>;
export type MenuFormData = z.infer<typeof menuSchema>;
export type RestaurantDataFormData = z.infer<typeof restaurantDataSchema>;
