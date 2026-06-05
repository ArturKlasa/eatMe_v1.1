import { z } from 'zod';
import { PRIMARY_PROTEINS, PrimaryProtein } from '../logic/protein';
import { DINING_FORMATS } from '../constants/menu';

const primaryProteinEnum = z.enum(
  PRIMARY_PROTEINS as unknown as [PrimaryProtein, ...PrimaryProtein[]]
);

const diningFormatEnum = z.enum(
  DINING_FORMATS as unknown as [
    (typeof DINING_FORMATS)[number],
    ...(typeof DINING_FORMATS)[number][],
  ]
);

export const menuScanJobInputSchema = z.object({
  images: z
    .array(
      z.object({
        bucket: z.literal('menu-scan-uploads'),
        path: z.string(),
        page: z.number().int().min(1),
      })
    )
    .min(1)
    .max(20),
});

export type MenuScanJobInput = z.infer<typeof menuScanJobInputSchema>;

export const confirmMenuScanPayloadSchema = z.object({
  job_id: z.string().uuid(),
  idempotency_key: z.string().min(10),
  dishes: z.array(
    z.object({
      menu_category_id: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      price: z.number().nonnegative(),
      // dish_kind retained through the Phase 2→4 window; Phase 7 drops it.
      dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']),
      primary_protein: primaryProteinEnum,
      is_template: z.boolean().default(false),
    })
  ),
});

export type ConfirmMenuScanPayload = z.infer<typeof confirmMenuScanPayloadSchema>;

// ── Modifier schemas (mirrors worker schema; canonical source for callers other than the worker) ──
//
// The worker (supabase/functions/menu-scan-worker/index.ts) keeps a local copy
// because Deno can't import workspace packages. Keep these two in lockstep.

export const modifierOptionSchema = z.object({
  name: z.string(),
  price_delta: z.number(),
  price_override: z.number().nullable(),
  primary_protein: primaryProteinEnum.nullable(),
  serves_delta: z.number().int(),
  is_default: z.boolean(),
});

export const modifierGroupSchema = z.object({
  name: z.string(),
  selection_type: z.enum(['single', 'multiple']),
  min_selections: z.number().int().min(0),
  max_selections: z.number().int().min(1),
  display_in_card: z.boolean(),
  options: z.array(modifierOptionSchema),
});

export const bundledItemSchema = z.object({
  name: z.string(),
  note: z.string().nullable(),
});

// ── MenuExtractionSchema ─────────────────────────────────────────────────────
// Used by menu-scan-worker Edge Function via zodResponseFormat(MenuExtractionSchema, 'menu_extraction').
// Pins dish_kind to the 5-value enum and primary_protein to the 11-value list,
// adds suggested_category_name, dining_format, bundled_items, modifier_groups.
// NOTE: a matching local copy lives in supabase/functions/menu-scan-worker/index.ts
// because the Edge Function (Deno) cannot import from the workspace package.

const menuExtractionDishSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  // Explicit portion size when written on the menu (e.g. "250g", "0.5L",
  // "8 oz", "6 szt."). Metric normalized to base units (kg→g, L→ml); ounces
  // kept as 'oz' (migration 148). Both null when the menu shows no portion.
  // Mirrors the worker copy. Persisted to dishes (migration 145).
  portion_amount: z.number().int().positive().nullable(),
  portion_unit: z.enum(['g', 'ml', 'pcs', 'oz']).nullable(),
  // Retained through the Phase 2→4 window; Phase 7 drops dish_kind in favour of
  // dining_format + modifier_groups.
  dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']),
  dining_format: diningFormatEnum.nullable(),
  bundled_items: z.array(bundledItemSchema),
  modifier_groups: z.array(modifierGroupSchema),
  primary_protein: primaryProteinEnum,
  suggested_category_name: z.string().nullable(),
  source_image_index: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

export const MenuExtractionSchema = z.object({
  dishes: z.array(menuExtractionDishSchema),
});

export type MenuExtractionResult = z.infer<typeof MenuExtractionSchema>;
export type MenuExtractionDish = z.infer<typeof menuExtractionDishSchema>;
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;
export type ModifierOption = z.infer<typeof modifierOptionSchema>;
export type BundledItem = z.infer<typeof bundledItemSchema>;
