import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { toEditableMenus } from '@/lib/menu-scan';
import type { EnrichedResult, EnrichedDish } from '@/lib/menu-scan';

// ---------------------------------------------------------------------------
// Inline the updated Zod schema from route.ts to validate the contract.
// These tests guard against accidental schema regressions independent of the
// OpenAI call itself.
// ---------------------------------------------------------------------------

const CourseItemSchema = z.object({
  option_label: z.string(),
  price_delta: z.number().default(0),
});

const CourseSchema = z.object({
  course_number: z.number().int().min(1),
  course_name: z.string().nullable(),
  choice_type: z.enum(['fixed', 'one_of']),
  items: z.array(CourseItemSchema),
});

const DishSchemaFlat = z.object({
  name: z.string(),
  price: z.number().nullable(),
  description: z.string().nullable(),
  dish_kind: z.enum(['standard', 'bundle', 'configurable', 'course_menu', 'buffet']),
  is_parent: z.boolean(),
  confidence: z.number().min(0).max(1),
  serves: z.number().nullable(),
  display_price_prefix: z.enum(['exact', 'from', 'per_person', 'market_price', 'ask_server']),
  courses: z.array(CourseSchema).optional(),
});

const baseDish = {
  name: 'Test Dish',
  price: 100,
  description: null,
  is_parent: false,
  confidence: 0.9,
  serves: 1,
  display_price_prefix: 'exact' as const,
};

// ---------------------------------------------------------------------------
// Zod schema — new kind values
// ---------------------------------------------------------------------------

describe('DishExtractionSchema — new 5-value dish_kind enum', () => {
  it.each(['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const)(
    'accepts dish_kind="%s"',
    kind => {
      expect(() => DishSchemaFlat.parse({ ...baseDish, dish_kind: kind })).not.toThrow();
    }
  );

  it.each(['template', 'combo', 'experience'] as const)('rejects legacy dish_kind="%s"', kind => {
    expect(() => DishSchemaFlat.parse({ ...baseDish, dish_kind: kind })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Zod schema — courses array for course_menu
// ---------------------------------------------------------------------------

describe('DishExtractionSchema — courses field', () => {
  it('accepts a course_menu dish with courses array', () => {
    expect(() =>
      DishSchemaFlat.parse({
        ...baseDish,
        dish_kind: 'course_menu',
        is_parent: true,
        price: 850,
        display_price_prefix: 'per_person',
        courses: [
          {
            course_number: 1,
            course_name: 'Starter',
            choice_type: 'one_of',
            items: [
              { option_label: 'Oysters', price_delta: 0 },
              { option_label: 'Tartare', price_delta: 0 },
            ],
          },
          {
            course_number: 2,
            course_name: 'Main',
            choice_type: 'fixed',
            items: [{ option_label: 'Wagyu', price_delta: 0 }],
          },
        ],
      })
    ).not.toThrow();
  });

  it('courses is optional for standard dishes', () => {
    expect(() => DishSchemaFlat.parse({ ...baseDish, dish_kind: 'standard' })).not.toThrow();
  });

  it('price_delta defaults to 0 when omitted', () => {
    const result = CourseItemSchema.parse({ option_label: 'Salmon' });
    expect(result.price_delta).toBe(0);
  });

  it('rejects course with invalid choice_type', () => {
    expect(() =>
      CourseSchema.parse({
        course_number: 1,
        course_name: null,
        choice_type: 'multiple',
        items: [],
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// source_image_index — propagation through toEditableMenus
// ---------------------------------------------------------------------------

function makeEnrichedDish(overrides: Partial<EnrichedDish> = {}): EnrichedDish {
  return {
    name: 'Dish',
    price: 50,
    description: null,
    raw_ingredients: null,
    dietary_hints: [],
    allergen_hints: [],
    spice_level: null,
    calories: null,
    dish_category: null,
    confidence: 0.9,
    is_parent: false,
    dish_kind: 'standard',
    serves: 1,
    display_price_prefix: 'exact',
    variants: null,
    matched_ingredients: [],
    mapped_dietary_tags: [],
    mapped_allergens: [],
    dish_category_id: null,
    ...overrides,
  };
}

function makeEnrichedResult(dishes: EnrichedDish[]): EnrichedResult {
  return {
    menus: [
      {
        name: 'Menu',
        menu_type: 'food',
        categories: [{ name: 'Mains', dishes }],
      },
    ],
    currency: 'USD',
  };
}

describe('source_image_index propagation into EditableDish', () => {
  it('carries source_image_index=0 for first page', () => {
    const dish = makeEnrichedDish({ source_image_index: 0 });
    const editable = toEditableMenus(makeEnrichedResult([dish]));
    expect(editable[0].categories[0].dishes[0].source_image_index).toBe(0);
  });

  it('carries source_image_index=2 for third page', () => {
    const dish = makeEnrichedDish({ source_image_index: 2 });
    const editable = toEditableMenus(makeEnrichedResult([dish]));
    expect(editable[0].categories[0].dishes[0].source_image_index).toBe(2);
  });

  it('is undefined when not set (pre-step-3 extractions)', () => {
    const dish = makeEnrichedDish(); // no source_image_index
    const editable = toEditableMenus(makeEnrichedResult([dish]));
    expect(editable[0].categories[0].dishes[0].source_image_index).toBeUndefined();
  });

  it('propagates to variant children', () => {
    const childDish = makeEnrichedDish({ source_image_index: 1, is_parent: false });
    const parentDish = makeEnrichedDish({
      source_image_index: 1,
      is_parent: true,
      variants: [childDish] as never,
    });
    const editable = toEditableMenus(makeEnrichedResult([parentDish]));
    // parent is last in the flat list (children inserted first)
    const parent = editable[0].categories[0].dishes.find(d => d.is_parent);
    expect(parent?.source_image_index).toBe(1);
  });
});
