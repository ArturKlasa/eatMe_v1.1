import { z } from 'zod';
import { PRIMARY_PROTEINS, PrimaryProtein } from '../logic/protein';

const primaryProteinEnum = z.enum(
  PRIMARY_PROTEINS as unknown as [PrimaryProtein, ...PrimaryProtein[]]
);

export const menuScanJobInputSchema = z.object({
  images: z
    .array(
      z.object({
        bucket: z.string(),
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
      dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']),
      primary_protein: primaryProteinEnum,
      is_template: z.boolean().default(false),
    })
  ),
});

export type ConfirmMenuScanPayload = z.infer<typeof confirmMenuScanPayloadSchema>;

// ── v2 MenuExtractionSchema ──────────────────────────────────────────────────
// Used by menu-scan-worker Edge Function via zodResponseFormat(MenuExtractionSchema, 'menu_extraction').
// v2-specific: drops allergen/dietary/ingredient extraction, pins dish_kind to the
// 5-value enum and primary_protein to the 11-value list, adds suggested_category_name.
// NOTE: a matching local copy lives in supabase/functions/menu-scan-worker/index.ts
// because the Edge Function (Deno) cannot import from the workspace package.

const menuExtractionDishSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']),
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
