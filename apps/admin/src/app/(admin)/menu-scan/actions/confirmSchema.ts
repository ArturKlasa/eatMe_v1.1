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
import { PRIMARY_PROTEINS } from '@eatme/shared';

export const DISH_KINDS = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;

export const PRICE_PREFIXES = [
  'exact',
  'from',
  'per_person',
  'market_price',
  'ask_server',
] as const;

export const reviewedCourseItemSchema = z.object({
  option_label: z.string().min(1).max(200),
  price_delta: z.number().default(0),
});

export const reviewedCourseSchema = z.object({
  course_number: z.number().int().min(1),
  course_name: z.string().max(200).nullable(),
  choice_type: z.enum(['fixed', 'one_of']),
  required_count: z.number().int().min(1).default(1),
  items: z.array(reviewedCourseItemSchema).max(50),
});

export type ReviewedCourse = z.infer<typeof reviewedCourseSchema>;

// Per-dish category resolution. Exactly one of the three category_* fields is
// expected to be set (or all null for "no category"). Validation below enforces
// that — the admin UI dropdown produces this shape directly.
//
// dish_category_id is independent of the menu_category fields above:
// menu_category drives the consumer-facing menu UI grouping, dish_category
// drives the global filtering/recommendation engine on mobile.
//
// is_parent / display_price_prefix / serves / variant_dishes / courses default
// to false / 'exact' / null / [] / [] so a Phase 3 client (which doesn't yet
// send these) still validates. Phase 4b ships the client payload extension.
export type ReviewedDish = {
  name: string;
  description: string | null;
  price: number | null;
  dish_kind: (typeof DISH_KINDS)[number];
  primary_protein: (typeof PRIMARY_PROTEINS)[number];
  source_image_index: number | null;
  category_existing_id: string | null;
  category_canonical_slug: string | null;
  category_custom_name: string | null;
  dish_category_id: string | null;
  is_parent: boolean;
  display_price_prefix: (typeof PRICE_PREFIXES)[number];
  serves: number | null;
  variant_dishes: ReviewedDish[];
  courses: ReviewedCourse[];
};

export const reviewedDishSchema: z.ZodType<ReviewedDish> = z.lazy(() =>
  z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).nullable(),
    price: z.number().nonnegative().nullable(),
    dish_kind: z.enum(DISH_KINDS),
    primary_protein: z.enum(PRIMARY_PROTEINS),
    source_image_index: z.number().int().min(0).nullable(),
    category_existing_id: z.string().uuid().nullable(),
    category_canonical_slug: z.string().min(1).max(100).nullable(),
    category_custom_name: z.string().min(1).max(200).nullable(),
    dish_category_id: z.string().uuid().nullable(),
    is_parent: z.boolean().default(false),
    display_price_prefix: z.enum(PRICE_PREFIXES).default('exact'),
    serves: z.number().int().min(1).nullable().default(null),
    variant_dishes: z.array(reviewedDishSchema).max(50).default([]),
    courses: z.array(reviewedCourseSchema).max(20).default([]),
  })
);

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
