import { z } from 'zod';
import { PRIMARY_PROTEINS, PrimaryProtein } from '../logic/protein';

const primaryProteinEnum = z.enum(
  PRIMARY_PROTEINS as unknown as [PrimaryProtein, ...PrimaryProtein[]]
);

const slotSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Slot name is required'),
  description: z.string().optional(),
  selection_type: z.enum(['single', 'multiple', 'quantity']),
  min_selections: z.number().int().min(0).default(0),
  max_selections: z.number().int().min(1).nullable().optional(),
  options: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, 'Option name is required'),
      price_delta: z.number().default(0),
    })
  ),
});

const courseSchema = z.object({
  id: z.string().optional(),
  course_number: z.number().int().min(1),
  course_name: z.string().nullable().optional(),
  required_count: z.number().int().min(1).default(1),
  choice_type: z.enum(['fixed', 'one_of']),
  items: z.array(
    z.object({
      id: z.string().optional(),
      option_label: z.string().min(1),
      price_delta: z.number().default(0),
      links_to_dish_id: z.string().uuid().nullable().optional(),
      sort_order: z.number().int().min(0).default(0),
    })
  ),
});

const baseDishV2 = z.object({
  id: z.string().optional(),
  menu_id: z.string().optional(),
  dish_category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'Dish name is required'),
  description: z.string().optional().or(z.literal('')),
  price: z.number().nonnegative(),
  primary_protein: primaryProteinEnum,
  photo_url: z.string().optional(),
  is_available: z.boolean().default(true).optional(),
  dietary_tags: z.array(z.string()).default([]),
  allergens: z.array(z.string()).default([]),
  display_price_prefix: z
    .enum(['exact', 'from', 'per_person', 'market_price', 'ask_server'])
    .default('exact'),
  serves: z.number().int().min(1).default(1).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft').optional(),
});

/** V2 dish schema — discriminated union on dish_kind. Named dishSchemaV2 to coexist with the v1 dishSchema. */
export const dishSchemaV2 = z.discriminatedUnion('dish_kind', [
  baseDishV2.extend({ dish_kind: z.literal('standard') }),
  baseDishV2.extend({
    dish_kind: z.literal('bundle'),
    bundle_items: z.array(z.string().uuid()),
  }),
  baseDishV2.extend({
    dish_kind: z.literal('configurable'),
    is_template: z.boolean().default(false),
    slots: z.array(slotSchema),
  }),
  baseDishV2.extend({
    dish_kind: z.literal('course_menu'),
    courses: z.array(courseSchema),
  }),
  baseDishV2.extend({ dish_kind: z.literal('buffet') }),
]);

export type DishV2Input = z.input<typeof dishSchemaV2>;
export type DishV2Output = z.infer<typeof dishSchemaV2>;
