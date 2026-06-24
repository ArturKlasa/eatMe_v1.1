import { describe, it, expect } from 'vitest';
import {
  type EditableDish,
  type ExtractedDish,
} from '@/app/(admin)/menu-scan/[jobId]/useReviewState';
import { buildConfirmPayload } from '@/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/buildConfirmPayload';
import {
  getGroupKey,
  asEditable,
} from '@/app/(admin)/menu-scan/[jobId]/ReviewDishEditor/reviewHelpers';

function makeDish(overrides: Partial<EditableDish> = {}): EditableDish {
  return {
    _id: 'dish-1',
    _deleted: false,
    name: 'Test',
    description: null,
    price: 10,
    primary_protein: 'chicken',
    suggested_category_name: null,
    canonical_category_slug: null,
    suggested_category_description: null,
    suggested_dish_category: null,
    source_image_index: 0,
    confidence: 0.9,
    categoryMode: 'none',
    categoryExistingId: null,
    categoryCanonicalSlug: null,
    categoryCustomName: '',
    dishCategoryId: null,
    dishCategoryUnmatched: false,
    display_price_prefix: 'exact',
    serves: null,
    dining_format: null,
    bundled_items: [],
    modifier_groups: [],
    portion_amount: null,
    portion_unit: null,
    ...overrides,
  };
}

// Stub getGroupMeta matching index.tsx's contract: the existing-mode group is
// description-locked (so its operator-entered description is forced to null in
// the payload), every other group is unlocked.
const LOCKED_EXISTING_KEY = 'e:existing-1';
function getGroupMeta(key: string) {
  return {
    displayName: key,
    descriptionLocked: key === LOCKED_EXISTING_KEY,
    badge: null,
  };
}

describe('buildConfirmPayload', () => {
  it('assembles the byte-identical confirm payload across all category modes + field permutations', () => {
    const dishes: EditableDish[] = [
      // custom-mode dish with a section description (desc survives — unlocked group)
      makeDish({
        _id: 'dish-custom',
        name: '  Spicy Wings  ',
        description: '  hot  ',
        price: 12.5,
        categoryMode: 'custom',
        categoryCustomName: '  Appetizers  ',
        source_image_index: 0,
      }),
      // canonical-mode dish → verbatim_name set from suggested_category_name
      makeDish({
        _id: 'dish-canonical',
        name: 'Margherita',
        categoryMode: 'canonical',
        categoryCanonicalSlug: 'pizza',
        suggested_category_name: '  PIZZE  ',
        source_image_index: 1,
        dining_format: 'shared_plates',
      }),
      // existing-mode dish with a locked description → desc forced null,
      // and no verbatim (not canonical) → entry is SKIPPED entirely
      makeDish({
        _id: 'dish-existing',
        name: 'House Salad',
        categoryMode: 'existing',
        categoryExistingId: 'existing-1',
        source_image_index: 2,
      }),
      // dish with modifier groups + options (incl. the L-2 post-collapse null
      // override), bundled items, portion fields
      makeDish({
        _id: 'dish-loaded',
        name: 'Combo Plate',
        price: 20,
        categoryMode: 'custom',
        categoryCustomName: 'Combos',
        portion_amount: 250,
        portion_unit: 'g',
        dining_format: 'sampler',
        serves: 2,
        bundled_items: [
          { _id: 'bi-1', name: '  Soup  ', note: '  of the day  ' },
          { _id: 'bi-2', name: 'Drink', note: null },
        ],
        modifier_groups: [
          {
            _id: 'mg-1',
            name: '  Size  ',
            selection_type: 'single',
            min_selections: 1,
            max_selections: 1,
            display_in_card: true,
            options: [
              {
                _id: 'mo-1',
                name: '  Large  ',
                price_delta: 3,
                // L-2: post-asEditable collapse leaves price_override null;
                // buildConfirmPayload passes it through unchanged.
                price_override: null,
                primary_protein: null,
                serves_delta: 0,
                is_default: true,
              },
            ],
          },
        ],
      }),
    ];

    const categoryDescriptions = new Map<string, string>([
      [getGroupKey(dishes[0]), '  Small plates to share  '],
      [LOCKED_EXISTING_KEY, 'should be dropped (locked)'],
      [getGroupKey(dishes[3]), 'Value combos'],
    ]);

    const payload = buildConfirmPayload({
      activeDishes: dishes,
      sourceLanguage: 'en',
      categoryDescriptions,
      getGroupKey,
      getGroupMeta,
    });

    expect(payload).toMatchInlineSnapshot(`
      {
        "category_descriptions": [
          {
            "canonical_slug": null,
            "custom_name": "Appetizers",
            "description": "Small plates to share",
            "existing_id": null,
            "verbatim_name": null,
          },
          {
            "canonical_slug": "pizza",
            "custom_name": null,
            "description": null,
            "existing_id": null,
            "verbatim_name": "PIZZE",
          },
          {
            "canonical_slug": null,
            "custom_name": "Combos",
            "description": "Value combos",
            "existing_id": null,
            "verbatim_name": null,
          },
        ],
        "dishes": [
          {
            "bundled_items": [],
            "category_canonical_slug": null,
            "category_custom_name": "Appetizers",
            "category_existing_id": null,
            "description": "hot",
            "dining_format": null,
            "dish_category_id": null,
            "display_price_prefix": "exact",
            "modifier_groups": [],
            "name": "Spicy Wings",
            "portion_amount": null,
            "portion_unit": null,
            "price": 12.5,
            "primary_protein": "chicken",
            "serves": null,
            "source_image_index": 0,
          },
          {
            "bundled_items": [],
            "category_canonical_slug": "pizza",
            "category_custom_name": null,
            "category_existing_id": null,
            "description": null,
            "dining_format": "shared_plates",
            "dish_category_id": null,
            "display_price_prefix": "exact",
            "modifier_groups": [],
            "name": "Margherita",
            "portion_amount": null,
            "portion_unit": null,
            "price": 10,
            "primary_protein": "chicken",
            "serves": null,
            "source_image_index": 1,
          },
          {
            "bundled_items": [],
            "category_canonical_slug": null,
            "category_custom_name": null,
            "category_existing_id": "existing-1",
            "description": null,
            "dining_format": null,
            "dish_category_id": null,
            "display_price_prefix": "exact",
            "modifier_groups": [],
            "name": "House Salad",
            "portion_amount": null,
            "portion_unit": null,
            "price": 10,
            "primary_protein": "chicken",
            "serves": null,
            "source_image_index": 2,
          },
          {
            "bundled_items": [
              {
                "name": "Soup",
                "note": "of the day",
              },
              {
                "name": "Drink",
                "note": null,
              },
            ],
            "category_canonical_slug": null,
            "category_custom_name": "Combos",
            "category_existing_id": null,
            "description": null,
            "dining_format": "sampler",
            "dish_category_id": null,
            "display_price_prefix": "exact",
            "modifier_groups": [
              {
                "display_in_card": true,
                "max_selections": 1,
                "min_selections": 1,
                "name": "Size",
                "options": [
                  {
                    "is_default": true,
                    "name": "Large",
                    "price_delta": 3,
                    "price_override": null,
                    "primary_protein": null,
                    "serves_delta": 0,
                  },
                ],
                "selection_type": "single",
              },
            ],
            "name": "Combo Plate",
            "portion_amount": 250,
            "portion_unit": "g",
            "price": 20,
            "primary_protein": "chicken",
            "serves": 2,
            "source_image_index": 0,
          },
        ],
        "source_language_code": "en",
      }
    `);
  });
});

describe('asEditable L-2 (price_override 0 -> null collapse)', () => {
  it('collapses an option price_override of 0 to null', () => {
    const extracted: ExtractedDish = {
      name: 'Pasta',
      description: null,
      price: 15,
      primary_protein: 'vegetarian',
      suggested_category_name: null,
      canonical_category_slug: null,
      suggested_category_description: null,
      suggested_dish_category: null,
      source_image_index: 0,
      confidence: 0.9,
      modifier_groups: [
        {
          name: 'Size',
          selection_type: 'single',
          min_selections: 1,
          max_selections: 1,
          display_in_card: false,
          options: [
            {
              name: 'Large',
              price_delta: 0,
              price_override: 0,
              primary_protein: null,
              serves_delta: 0,
              is_default: false,
            },
          ],
        },
      ],
    };

    const editable = asEditable(extracted, 0, new Set(), new Map());
    expect(editable.modifier_groups[0].options[0].price_override).toBeNull();
  });
});
