import { z } from 'zod';
import { PRIMARY_PROTEINS, PrimaryProtein } from '../logic/protein';
import { DINING_FORMATS } from '../constants/menu';
import { modifierGroupSchema, bundledItemSchema } from './menuScan';

const primaryProteinEnum = z.enum(
  PRIMARY_PROTEINS as unknown as [PrimaryProtein, ...PrimaryProtein[]]
);

const diningFormatEnum = z.enum(
  DINING_FORMATS as unknown as [
    (typeof DINING_FORMATS)[number],
    ...(typeof DINING_FORMATS)[number][],
  ]
);

/**
 * Flat dish schema (2026-05-18 — dish-model rewrite Phase 3).
 *
 * The previous discriminated-union-on-dish_kind shape collapsed into this single
 * schema: every dish is one row with optional `modifier_groups` for choices and
 * optional `dining_format` for experience-style dishes. `dish_kind` is kept
 * during the Phase 2→4 transition window; Phase 7 drops it.
 */
export const dishSchemaV2 = z.object({
  id: z.string().optional(),
  menu_id: z.string().optional(),
  dish_category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'Dish name is required'),
  description: z.string().optional().or(z.literal('')),
  price: z.number().nonnegative(),
  primary_protein: primaryProteinEnum,
  photo_url: z.string().optional(),
  is_available: z.boolean().default(true).optional(),
  display_price_prefix: z
    .enum(['exact', 'from', 'per_person', 'market_price', 'ask_server'])
    .default('exact'),
  serves: z.number().int().min(1).default(1).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft').optional(),
  // ── Modifier-model fields ────────────────────────────────────────────────
  dining_format: diningFormatEnum.nullable().default(null),
  bundled_items: z.array(bundledItemSchema).nullable().default(null),
  modifier_groups: z.array(modifierGroupSchema).default([]),
  // ── Portion size (migration 145; 'oz' added migration 148) ───────────────
  // Explicit "250g" / "0.5L" / "8 oz" / "6 szt." extracted by menu-scan AI or
  // set by the admin. DB CHECK enforces both-set-or-both-null; the form pairs them.
  portion_amount: z.number().int().positive().nullable().optional(),
  portion_unit: z.enum(['g', 'ml', 'pcs', 'oz']).nullable().optional(),
  // ── Availability windows (migration 141) ─────────────────────────────────
  available_days: z.array(z.string()).nullable().optional(),
  available_hours_start: z.string().nullable().optional(),
  available_hours_end: z.string().nullable().optional(),
  available_from: z.string().nullable().optional(),
  available_until: z.string().nullable().optional(),
  // ── Legacy back-compat (Phase 7 drops these) ─────────────────────────────
  dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']).optional(),
  is_template: z.boolean().optional(),
});

export type DishV2Input = z.input<typeof dishSchemaV2>;
export type DishV2Output = z.infer<typeof dishSchemaV2>;
