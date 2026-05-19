// Schema-level tests for the new flat dish payload (Phase 4.3a). The previous
// confirm-multi-kind suite exercised the inline multi-pass insert logic — that
// behaviour now lives in the `admin_confirm_menu_scan` Postgres function
// (migration 144) and is covered end-to-end by the integration test at
// apps/admin/src/__tests__/integration/admin-confirm-rpc.test.ts.
//
// These tests stay narrow: they confirm `confirmPayloadSchema` accepts the
// shapes the admin review UI emits (standalone, modifier groups, configurable,
// course menu, buffet) and rejects clearly invalid payloads.

import { describe, it, expect } from 'vitest';
import {
  confirmPayloadSchema,
  reviewedDishSchema,
  reviewedModifierGroupSchema,
} from '@/app/(admin)/menu-scan/actions/confirmSchema';

const MINIMAL_DISH = {
  name: 'Test Dish',
  description: null,
  price: 10,
  primary_protein: 'chicken' as const,
  source_image_index: 0,
  category_existing_id: null,
  category_canonical_slug: null,
  category_custom_name: null,
  dish_category_id: null,
};

describe('reviewedDishSchema — defaults', () => {
  it('applies defaults for display_price_prefix / serves / dining_format / bundled_items / modifier_groups', () => {
    const parsed = reviewedDishSchema.parse(MINIMAL_DISH);
    expect(parsed.display_price_prefix).toBe('exact');
    expect(parsed.serves).toBe(null);
    expect(parsed.dining_format).toBe(null);
    expect(parsed.bundled_items).toEqual([]);
    expect(parsed.modifier_groups).toEqual([]);
  });

  it('rejects invalid display_price_prefix', () => {
    const result = reviewedDishSchema.safeParse({ ...MINIMAL_DISH, display_price_prefix: 'bogus' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid dining_format', () => {
    const result = reviewedDishSchema.safeParse({ ...MINIMAL_DISH, dining_format: 'spaceship' });
    expect(result.success).toBe(false);
  });

  it('rejects negative price', () => {
    const result = reviewedDishSchema.safeParse({ ...MINIMAL_DISH, price: -1 });
    expect(result.success).toBe(false);
  });
});

describe('reviewedModifierGroupSchema', () => {
  it('accepts a "required single" group (e.g. Pad Thai protein choice)', () => {
    const parsed = reviewedModifierGroupSchema.parse({
      name: 'Protein',
      selection_type: 'single',
      min_selections: 1,
      max_selections: 1,
      display_in_card: true,
      options: [
        {
          name: 'Chicken',
          price_delta: 0,
          primary_protein: 'chicken',
          is_default: true,
        },
        { name: 'Tofu', price_delta: 0, primary_protein: 'vegan' },
        { name: 'Shrimp', price_delta: 3 },
      ],
    });
    expect(parsed.options).toHaveLength(3);
    expect(parsed.options[0].is_default).toBe(true);
    // applied defaults
    expect(parsed.options[1].is_default).toBe(false);
    expect(parsed.options[1].price_override).toBe(null);
    expect(parsed.options[2].primary_protein).toBe(null);
  });

  it('accepts an "optional multi" group (e.g. Caesar extras)', () => {
    const parsed = reviewedModifierGroupSchema.parse({
      name: 'Extras',
      selection_type: 'multiple',
      min_selections: 0,
      max_selections: 4,
      display_in_card: false,
      options: [
        { name: 'Anchovies', price_delta: 1 },
        { name: 'Extra parmesan', price_delta: 1 },
      ],
    });
    expect(parsed.selection_type).toBe('multiple');
    expect(parsed.min_selections).toBe(0);
  });

  it('rejects invalid selection_type', () => {
    const result = reviewedModifierGroupSchema.safeParse({
      name: 'Bad',
      selection_type: 'quantity',
      min_selections: 0,
      max_selections: 1,
      display_in_card: false,
      options: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects max_selections < 1', () => {
    const result = reviewedModifierGroupSchema.safeParse({
      name: 'Bad',
      selection_type: 'single',
      min_selections: 0,
      max_selections: 0,
      display_in_card: false,
      options: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('confirmPayloadSchema — full-payload shapes from admin UI', () => {
  it('accepts a standalone (no modifiers) payload', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [{ ...MINIMAL_DISH, name: 'Margherita', price: 15 }],
      source_language_code: 'en',
    });
    expect(parsed.dishes).toHaveLength(1);
    expect(parsed.dishes[0].modifier_groups).toEqual([]);
  });

  it('accepts a Pad Thai-shaped dish with a required-single protein group', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'Pad Thai',
          price: 14,
          modifier_groups: [
            {
              name: 'Protein',
              selection_type: 'single',
              min_selections: 1,
              max_selections: 1,
              display_in_card: true,
              options: [
                { name: 'Chicken', price_delta: 0, primary_protein: 'chicken', is_default: true },
                { name: 'Tofu', price_delta: 0, primary_protein: 'vegan' },
                { name: 'Shrimp', price_delta: 3, primary_protein: 'shellfish' },
                { name: 'Beef', price_delta: 2, primary_protein: 'beef' },
              ],
            },
          ],
        },
      ],
      source_language_code: 'en',
    });
    expect(parsed.dishes[0].modifier_groups[0].options).toHaveLength(4);
  });

  it('accepts a build-your-own bowl (multi-group)', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'Poke Bowl',
          price: 14,
          display_price_prefix: 'from',
          modifier_groups: [
            {
              name: 'Base',
              selection_type: 'single',
              min_selections: 1,
              max_selections: 1,
              display_in_card: false,
              options: [{ name: 'Rice' }, { name: 'Greens' }],
            },
            {
              name: 'Proteins',
              selection_type: 'multiple',
              min_selections: 1,
              max_selections: 3,
              display_in_card: true,
              options: [
                { name: 'Tuna', primary_protein: 'fish' },
                { name: 'Salmon', primary_protein: 'fish' },
                { name: 'Tofu', primary_protein: 'vegan' },
              ],
            },
            {
              name: 'Toppings',
              selection_type: 'multiple',
              min_selections: 0,
              max_selections: 10,
              display_in_card: false,
              options: [{ name: 'Edamame' }, { name: 'Seaweed' }],
            },
          ],
        },
      ],
      source_language_code: 'en',
    });
    expect(parsed.dishes[0].modifier_groups).toHaveLength(3);
  });

  it('accepts a course_menu dining_format (replaces dish_kind="course_menu")', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [
        {
          ...MINIMAL_DISH,
          name: "Chef's Tasting",
          price: 850,
          display_price_prefix: 'per_person',
          dining_format: 'course_menu',
          modifier_groups: [
            {
              name: 'Course 1 — Starter',
              selection_type: 'single',
              min_selections: 1,
              max_selections: 1,
              display_in_card: false,
              options: [
                { name: 'Tuna Tartare', price_delta: 0 },
                { name: 'Beet Salad', price_delta: 0 },
              ],
            },
          ],
        },
      ],
      source_language_code: 'en',
    });
    expect(parsed.dishes[0].dining_format).toBe('course_menu');
    expect(parsed.dishes[0].display_price_prefix).toBe('per_person');
  });

  it('accepts a buffet dining_format with serves', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'AYCE BBQ',
          price: 299,
          display_price_prefix: 'per_person',
          dining_format: 'buffet',
          serves: 1,
        },
      ],
      source_language_code: 'en',
    });
    expect(parsed.dishes[0].dining_format).toBe('buffet');
    expect(parsed.dishes[0].serves).toBe(1);
  });

  it('accepts a bundled dish with bundled_items', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'Lunch Combo',
          price: 129,
          bundled_items: [
            { name: 'Soup of the day', note: null },
            { name: 'Side salad', note: 'tossed' },
            { name: 'Drink' },
          ],
        },
      ],
      source_language_code: 'en',
    });
    expect(parsed.dishes[0].bundled_items).toHaveLength(3);
    expect(parsed.dishes[0].bundled_items[2].note).toBe(null);
  });

  it('accepts a tiered-pricing option using price_override (e.g. wings 6/12/18)', () => {
    const parsed = confirmPayloadSchema.parse({
      dishes: [
        {
          ...MINIMAL_DISH,
          name: 'Wings',
          price: 8,
          display_price_prefix: 'from',
          modifier_groups: [
            {
              name: 'Quantity',
              selection_type: 'single',
              min_selections: 1,
              max_selections: 1,
              display_in_card: true,
              options: [
                { name: '6 wings', price_override: 8, is_default: true },
                { name: '12 wings', price_override: 15 },
                { name: '18 wings', price_override: 20 },
              ],
            },
          ],
        },
      ],
      source_language_code: 'en',
    });
    expect(parsed.dishes[0].modifier_groups[0].options[1].price_override).toBe(15);
  });

  it('rejects payload with zero dishes', () => {
    const result = confirmPayloadSchema.safeParse({ dishes: [], source_language_code: 'en' });
    expect(result.success).toBe(false);
  });
});
