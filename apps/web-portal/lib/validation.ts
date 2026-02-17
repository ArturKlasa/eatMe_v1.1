import { z } from 'zod';

export const basicInfoSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(5, 'Please enter a valid address'),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number (e.g., +1234567890)'),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  price_range: z.enum(['$', '$$', '$$$', '$$$$'], {
    message: 'Please select a price range',
  }),
  cuisines: z.array(z.string()).min(1, 'Please select at least one cuisine'),
});

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
  average_prep_time_minutes: z
    .number()
    .min(5, 'Prep time must be at least 5 minutes')
    .max(180, 'Prep time must be less than 180 minutes'),
  accepts_reservations: z.boolean(),
});

export const dishSchema = z.object({
  id: z.string().optional(),
  menu_id: z.string().optional(),
  name: z.string().min(2, 'Dish name must be at least 2 characters'),
  description: z.string().optional().or(z.literal('')),
  price: z
    .number()
    .positive('Price must be greater than 0')
    .max(10000, 'Price seems unreasonably high'),
  calories: z.number().min(0).max(5000).optional().or(z.nan()),
  dietary_tags: z.array(z.string()),
  allergens: z.array(z.string()),
  ingredients: z.array(z.string()).optional().default([]),
  spice_level: z.number().min(0).max(4).optional().or(z.nan()),
  photo_url: z.string().optional(),
  is_available: z.boolean().optional(),
});

export const menuSchema = z.object({
  dishes: z.array(dishSchema).min(1, 'Please add at least one dish'),
});

export const restaurantDataSchema = z.object({
  restaurant: basicInfoSchema.merge(operationsSchema),
  dishes: z.array(dishSchema).min(1, 'Please add at least one dish'),
});

export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
export type OperationsFormData = z.infer<typeof operationsSchema>;
export type DishFormData = z.infer<typeof dishSchema>;
export type MenuFormData = z.infer<typeof menuSchema>;
export type RestaurantDataFormData = z.infer<typeof restaurantDataSchema>;
