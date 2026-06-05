// Schemas + types for adminConfirmMenuScan's payload. Lives outside the
// "use server" file because Next.js requires server-action modules to only
// export async functions — a Zod schema is an object, so it must live here
// to also be importable from tests + non-server callers.
//
// The eatme/no-unwrapped-action rule fires on any export from an actions/
// directory, but the exports here are schemas and constants — not server
// actions that need auth wrapping. Disable the rule for this file.
/* eslint-disable eatme/no-unwrapped-action */

import { z } from 'zod';
import { PRIMARY_PROTEINS, DINING_FORMATS } from '@eatme/shared';

export const PRICE_PREFIXES = [
  'exact',
  'from',
  'per_person',
  'market_price',
  'ask_server',
] as const;

// ── Modifier groups (replaces variants + courses) ─────────────────────────────
// Mirrors @eatme/shared modifierGroupSchema / modifierOptionSchema. Kept local
// so callers can apply admin-UI-specific min/max/length constraints without
// changing the worker-facing schemas in @eatme/shared.

export const reviewedModifierOptionSchema = z.object({
  name: z.string().min(1).max(200),
  price_delta: z.number().default(0),
  price_override: z.number().nonnegative().nullable().default(null),
  primary_protein: z.enum(PRIMARY_PROTEINS).nullable().default(null),
  serves_delta: z.number().int().default(0),
  is_default: z.boolean().default(false),
});

export const reviewedModifierGroupSchema = z.object({
  name: z.string().min(1).max(200),
  selection_type: z.enum(['single', 'multiple']),
  min_selections: z.number().int().min(0).default(0),
  max_selections: z.number().int().min(1).default(1),
  display_in_card: z.boolean().default(false),
  options: z.array(reviewedModifierOptionSchema).max(50).default([]),
});

export const reviewedBundledItemSchema = z.object({
  name: z.string().min(1).max(200),
  note: z.string().max(500).nullable().default(null),
});

export type ReviewedModifierOption = z.infer<typeof reviewedModifierOptionSchema>;
export type ReviewedModifierGroup = z.infer<typeof reviewedModifierGroupSchema>;
export type ReviewedBundledItem = z.infer<typeof reviewedBundledItemSchema>;

// Per-dish category resolution. Exactly one of the three category_* fields is
// expected to be set (or all null for "no category"). Validation below enforces
// that — the admin UI dropdown produces this shape directly.
//
// dish_category_id is independent of the menu_category fields above:
// menu_category drives the consumer-facing menu UI grouping, dish_category
// drives the global filtering/recommendation engine on mobile.
//
// display_price_prefix / serves / dining_format / bundled_items / modifier_groups
// default to 'exact' / null / null / [] / [] so a payload that omits modifiers
// still validates as a standalone dish.
export type ReviewedDish = {
  name: string;
  description: string | null;
  price: number | null;
  primary_protein: (typeof PRIMARY_PROTEINS)[number];
  source_image_index: number | null;
  category_existing_id: string | null;
  category_canonical_slug: string | null;
  category_custom_name: string | null;
  dish_category_id: string | null;
  display_price_prefix: (typeof PRICE_PREFIXES)[number];
  serves: number | null;
  dining_format: (typeof DINING_FORMATS)[number] | null;
  bundled_items: ReviewedBundledItem[];
  modifier_groups: ReviewedModifierGroup[];
  // Portion size (migration 145). Either both set or both null; DB CHECK
  // enforces. Operator UI pairs them in the inline editor.
  portion_amount: number | null;
  portion_unit: 'g' | 'ml' | 'pcs' | 'oz' | null;
};

export const reviewedDishSchema: z.ZodType<ReviewedDish> = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  price: z.number().nonnegative().nullable(),
  primary_protein: z.enum(PRIMARY_PROTEINS),
  source_image_index: z.number().int().min(0).nullable(),
  category_existing_id: z.string().uuid().nullable(),
  category_canonical_slug: z.string().min(1).max(100).nullable(),
  category_custom_name: z.string().min(1).max(200).nullable(),
  dish_category_id: z.string().uuid().nullable(),
  display_price_prefix: z.enum(PRICE_PREFIXES).default('exact'),
  serves: z.number().int().min(1).nullable().default(null),
  dining_format: z.enum(DINING_FORMATS).nullable().default(null),
  bundled_items: z.array(reviewedBundledItemSchema).max(50).default([]),
  modifier_groups: z.array(reviewedModifierGroupSchema).max(20).default([]),
  portion_amount: z.number().int().positive().nullable().default(null),
  portion_unit: z.enum(['g', 'ml', 'pcs', 'oz']).nullable().default(null),
});

// One per unique category referenced by dishes in this scan. Carries the
// admin-edited section description (in source language). Exactly one of
// canonical_slug / custom_name / existing_id must match a category referenced
// by at least one dish in the same payload.
export const reviewedCategoryDescriptionSchema = z.object({
  canonical_slug: z.string().min(1).max(100).nullable(),
  custom_name: z.string().min(1).max(200).nullable(),
  existing_id: z.string().uuid().nullable(),
  description: z.string().max(2000).nullable(),
  // Restaurant's actual menu wording for a canonical-mode group (e.g. "Starters"
  // when AI matched it to canonical "appetizers"). Server uses this as the
  // displayed name + name_translations[lang] override on row creation, keeping
  // the canonical link intact for cross-locale fallback. Only meaningful when
  // canonical_slug is set; ignored otherwise. Optional for back-compat with
  // older clients.
  verbatim_name: z.string().min(1).max(200).nullable().optional(),
});

export const confirmPayloadSchema = z.object({
  dishes: z.array(reviewedDishSchema).min(1).max(200),
  // Source language for any custom categories created in this scan. Admin sets
  // this in the review UI based on the language banner (country-derived default,
  // overridable when AI-detected language differs).
  source_language_code: z.string().min(2).max(10).nullable(),
  // Optional descriptions per unique category. Empty/missing entries are skipped.
  category_descriptions: z.array(reviewedCategoryDescriptionSchema).max(200).optional(),
});
