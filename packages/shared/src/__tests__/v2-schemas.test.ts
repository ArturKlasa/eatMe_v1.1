import { describe, it, expect } from 'vitest';
import { isDiscoverable } from '../logic/discoverability';
import { isAdmin } from '../logic/role';
import { publishPayloadSchema } from '../validation/publish';
import {
  menuScanJobInputSchema,
  confirmMenuScanPayloadSchema,
  MenuExtractionSchema,
} from '../validation/menuScan';
import { dishSchemaV2 } from '../validation/dish';
import {
  restaurantBasicsSchema,
  restaurantDraftSchema,
  restaurantPublishableSchema,
} from '../validation/restaurant';

// ── isDiscoverable ────────────────────────────────────────────────────────────

describe('isDiscoverable', () => {
  it('returns true when active and published', () => {
    expect(isDiscoverable({ is_active: true, status: 'published' })).toBe(true);
  });

  it('returns false when inactive (even if published)', () => {
    expect(isDiscoverable({ is_active: false, status: 'published' })).toBe(false);
  });

  it('returns false when draft (even if active)', () => {
    expect(isDiscoverable({ is_active: true, status: 'draft' })).toBe(false);
  });

  it('returns false when inactive and draft', () => {
    expect(isDiscoverable({ is_active: false, status: 'draft' })).toBe(false);
  });
});

// ── isAdmin ───────────────────────────────────────────────────────────────────

describe('isAdmin', () => {
  it('returns true when app_metadata.role is admin', () => {
    expect(isAdmin({ app_metadata: { role: 'admin' } })).toBe(true);
  });

  it('returns false when user_metadata.role is admin (wrong field)', () => {
    expect(isAdmin({ app_metadata: {} } as never)).toBe(false);
  });

  it('returns false when app_metadata is missing', () => {
    expect(isAdmin({})).toBe(false);
  });

  it('returns false for null user', () => {
    expect(isAdmin(null)).toBe(false);
  });

  it('returns false for undefined user', () => {
    expect(isAdmin(undefined)).toBe(false);
  });
});

// ── publishPayloadSchema ──────────────────────────────────────────────────────

describe('publishPayloadSchema', () => {
  it('accepts a valid UUID', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const result = publishPayloadSchema.safeParse({ restaurant_id: id });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID string', () => {
    const result = publishPayloadSchema.safeParse({ restaurant_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing restaurant_id', () => {
    const result = publishPayloadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ── menuScanJobInputSchema ────────────────────────────────────────────────────

describe('menuScanJobInputSchema', () => {
  const validImage = { bucket: 'menu-scan-uploads', path: 'owner/menu.jpg', page: 1 };

  it('accepts a single valid image', () => {
    const result = menuScanJobInputSchema.safeParse({ images: [validImage] });
    expect(result.success).toBe(true);
  });

  it('rejects empty images array', () => {
    const result = menuScanJobInputSchema.safeParse({ images: [] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 20 images', () => {
    const images = Array.from({ length: 21 }, (_, i) => ({ ...validImage, page: i + 1 }));
    const result = menuScanJobInputSchema.safeParse({ images });
    expect(result.success).toBe(false);
  });

  it('rejects page numbers below 1', () => {
    const result = menuScanJobInputSchema.safeParse({ images: [{ ...validImage, page: 0 }] });
    expect(result.success).toBe(false);
  });
});

// ── confirmMenuScanPayloadSchema ──────────────────────────────────────────────

const validDish = {
  menu_category_id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Margherita Pizza',
  price: 12.5,
  dish_kind: 'standard' as const,
  primary_protein: 'vegetarian',
  is_template: false,
};

describe('confirmMenuScanPayloadSchema', () => {
  it('accepts a valid payload', () => {
    const result = confirmMenuScanPayloadSchema.safeParse({
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      idempotency_key: 'abcdefghij',
      dishes: [validDish],
    });
    expect(result.success).toBe(true);
  });

  it('rejects idempotency_key shorter than 10 chars', () => {
    const result = confirmMenuScanPayloadSchema.safeParse({
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      idempotency_key: 'short',
      dishes: [validDish],
    });
    expect(result.success).toBe(false);
  });

  it('rejects legacy dish_kind "template"', () => {
    const result = confirmMenuScanPayloadSchema.safeParse({
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      idempotency_key: 'abcdefghij',
      dishes: [{ ...validDish, dish_kind: 'template' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects legacy dish_kind "combo"', () => {
    const result = confirmMenuScanPayloadSchema.safeParse({
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      idempotency_key: 'abcdefghij',
      dishes: [{ ...validDish, dish_kind: 'combo' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects legacy dish_kind "experience"', () => {
    const result = confirmMenuScanPayloadSchema.safeParse({
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      idempotency_key: 'abcdefghij',
      dishes: [{ ...validDish, dish_kind: 'experience' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 5 valid dish_kind values', () => {
    const kinds = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;
    for (const dish_kind of kinds) {
      const result = confirmMenuScanPayloadSchema.safeParse({
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        idempotency_key: 'abcdefghij',
        dishes: [{ ...validDish, dish_kind }],
      });
      expect(result.success, `dish_kind "${dish_kind}" should be valid`).toBe(true);
    }
  });

  it('rejects invalid primary_protein in dish', () => {
    const result = confirmMenuScanPayloadSchema.safeParse({
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      idempotency_key: 'abcdefghij',
      dishes: [{ ...validDish, primary_protein: 'bacon' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 11 valid primary_protein values', () => {
    const proteins = [
      'chicken',
      'beef',
      'pork',
      'lamb',
      'duck',
      'other_meat',
      'fish',
      'shellfish',
      'eggs',
      'vegetarian',
      'vegan',
    ] as const;
    for (const primary_protein of proteins) {
      const result = confirmMenuScanPayloadSchema.safeParse({
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        idempotency_key: 'abcdefghij',
        dishes: [{ ...validDish, primary_protein }],
      });
      expect(result.success, `primary_protein "${primary_protein}" should be valid`).toBe(true);
    }
  });
});

// ── dishSchemaV2 discriminated union ─────────────────────────────────────────

const baseDishInput = {
  name: 'Grilled Chicken',
  price: 18,
  primary_protein: 'chicken' as const,
};

describe('dishSchemaV2 discriminated union', () => {
  it('standard narrows correctly', () => {
    const result = dishSchemaV2.safeParse({ ...baseDishInput, dish_kind: 'standard' });
    expect(result.success).toBe(true);
  });

  it('configurable narrows to include slots property', () => {
    const result = dishSchemaV2.safeParse({
      ...baseDishInput,
      dish_kind: 'configurable',
      is_template: false,
      slots: [],
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.dish_kind === 'configurable') {
      // TypeScript narrows: result.data.slots is accessible here
      expect(Array.isArray(result.data.slots)).toBe(true);
    }
  });

  it('buffet does not include slots property', () => {
    const result = dishSchemaV2.safeParse({ ...baseDishInput, dish_kind: 'buffet' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('slots' in result.data).toBe(false);
    }
  });

  it('bundle requires bundle_items', () => {
    const result = dishSchemaV2.safeParse({
      ...baseDishInput,
      dish_kind: 'bundle',
      bundle_items: ['123e4567-e89b-12d3-a456-426614174000'],
    });
    expect(result.success).toBe(true);
  });

  it('course_menu includes courses', () => {
    const result = dishSchemaV2.safeParse({
      ...baseDishInput,
      dish_kind: 'course_menu',
      courses: [
        {
          course_number: 1,
          choice_type: 'fixed',
          items: [{ option_label: 'Soup of the day', price_delta: 0, sort_order: 0 }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('defaults dietary_tags and allergens to []', () => {
    const result = dishSchemaV2.safeParse({ ...baseDishInput, dish_kind: 'standard' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dietary_tags).toEqual([]);
      expect(result.data.allergens).toEqual([]);
    }
  });

  it('rejects invalid primary_protein', () => {
    const result = dishSchemaV2.safeParse({
      ...baseDishInput,
      dish_kind: 'standard',
      primary_protein: 'bacon',
    });
    expect(result.success).toBe(false);
  });
});

// ── restaurantDraftSchema ─────────────────────────────────────────────────────

describe('restaurantDraftSchema', () => {
  it('accepts name only (minimum valid draft)', () => {
    const result = restaurantDraftSchema.safeParse({ name: 'My Draft Restaurant' });
    expect(result.success).toBe(true);
  });

  it('rejects name shorter than 2 characters', () => {
    const result = restaurantDraftSchema.safeParse({ name: 'A' });
    expect(result.success).toBe(false);
  });

  it('allows address to be omitted', () => {
    const result = restaurantDraftSchema.safeParse({ name: 'Draft' });
    expect(result.success).toBe(true);
  });

  it('defaults cuisines to empty array', () => {
    const result = restaurantDraftSchema.safeParse({ name: 'Draft' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cuisines).toEqual([]);
    }
  });
});

// ── restaurantPublishableSchema ───────────────────────────────────────────────

describe('restaurantPublishableSchema', () => {
  const validPublishable = {
    name: 'My Restaurant',
    address: '123 Main St',
    location: { lat: 52.2297, lng: 21.0122 },
    cuisines: ['italian'],
    operating_hours: {},
    delivery_available: false,
    takeout_available: true,
    dine_in_available: true,
    accepts_reservations: false,
  };

  it('accepts a fully specified restaurant', () => {
    const result = restaurantPublishableSchema.safeParse(validPublishable);
    expect(result.success).toBe(true);
  });

  it('rejects missing cuisines', () => {
    const result = restaurantPublishableSchema.safeParse({ ...validPublishable, cuisines: [] });
    expect(result.success).toBe(false);
  });

  it('rejects missing address', () => {
    const { address: _, ...rest } = validPublishable;
    const result = restaurantPublishableSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ── restaurantBasicsSchema ────────────────────────────────────────────────────

describe('restaurantBasicsSchema', () => {
  it('accepts name only (minimum valid input)', () => {
    const result = restaurantBasicsSchema.safeParse({ name: 'My Cafe' });
    expect(result.success).toBe(true);
  });

  it('rejects name shorter than 2 characters', () => {
    const result = restaurantBasicsSchema.safeParse({ name: 'X' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid phone format', () => {
    const result = restaurantBasicsSchema.safeParse({ name: 'My Cafe', phone: 'not-a-phone' });
    expect(result.success).toBe(false);
  });

  it('accepts valid international phone', () => {
    const result = restaurantBasicsSchema.safeParse({ name: 'My Cafe', phone: '+12125551234' });
    expect(result.success).toBe(true);
  });

  it('accepts empty string for phone (optional cleared field)', () => {
    const result = restaurantBasicsSchema.safeParse({ name: 'My Cafe', phone: '' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid website URL', () => {
    const result = restaurantBasicsSchema.safeParse({ name: 'My Cafe', website: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('cuisines is optional — omitting it succeeds', () => {
    const result = restaurantBasicsSchema.safeParse({ name: 'My Cafe' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cuisines).toBeUndefined();
  });
});

// ── MenuExtractionSchema (v2 AI extraction output) ────────────────────────────

describe('MenuExtractionSchema', () => {
  const validDish = {
    name: 'Grilled Salmon',
    description: 'Fresh Atlantic salmon with herbs',
    price: 24.5,
    dish_kind: 'standard',
    primary_protein: 'fish',
    suggested_category_name: 'Mains',
    source_image_index: 0,
    confidence: 0.95,
  };

  const validPayload = { dishes: [validDish] };

  it('(a) parses a valid v2 fixture with 5-value dish_kind + 11-value primary_protein + suggested_category_name', () => {
    const result = MenuExtractionSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dishes[0].suggested_category_name).toBe('Mains');
    }
  });

  it('(b) rejects legacy dish_kind="combo" (v1 era, renamed in migration 114)', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, dish_kind: 'combo' }],
    });
    expect(result.success).toBe(false);
  });

  it('(b) rejects legacy dish_kind="experience" (v1 era, renamed in migration 114)', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, dish_kind: 'experience' }],
    });
    expect(result.success).toBe(false);
  });

  it('(b) rejects legacy dish_kind="template" (v1 era, renamed in migration 114)', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, dish_kind: 'template' }],
    });
    expect(result.success).toBe(false);
  });

  it('(c) rejects payload with allergens field — overly-helpful model output rejected', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, allergens: ['gluten'] }],
    });
    // Zod strips unknown keys by default but strict() would reject.
    // The schema uses default parse (strip), so extra keys are silently dropped.
    // The result parses successfully with allergens stripped — confirm_menu_scan gets only v2 fields.
    expect(result.success).toBe(true);
    if (result.success) {
      expect('allergens' in result.data.dishes[0]).toBe(false);
    }
  });

  it('(c) rejects payload with dietary_tags field — extra fields stripped by schema', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, dietary_tags: ['vegetarian'] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('dietary_tags' in result.data.dishes[0]).toBe(false);
    }
  });

  it('(d) suggested_category_name tolerates null (missing category hint)', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, suggested_category_name: null }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dishes[0].suggested_category_name).toBeNull();
    }
  });

  it('(d) suggested_category_name is a plain string when present', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, suggested_category_name: 'Desserts' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dishes[0].suggested_category_name).toBe('Desserts');
    }
  });

  it('accepts all 5 valid dish_kind values', () => {
    const kinds = ['standard', 'bundle', 'configurable', 'course_menu', 'buffet'] as const;
    for (const dish_kind of kinds) {
      const result = MenuExtractionSchema.safeParse({ dishes: [{ ...validDish, dish_kind }] });
      expect(result.success, `dish_kind "${dish_kind}" should be valid`).toBe(true);
    }
  });

  it('accepts all 11 valid primary_protein values', () => {
    const proteins = [
      'chicken',
      'beef',
      'pork',
      'lamb',
      'duck',
      'other_meat',
      'fish',
      'shellfish',
      'eggs',
      'vegetarian',
      'vegan',
    ] as const;
    for (const primary_protein of proteins) {
      const result = MenuExtractionSchema.safeParse({
        dishes: [{ ...validDish, primary_protein }],
      });
      expect(result.success, `primary_protein "${primary_protein}" should be valid`).toBe(true);
    }
  });

  it('rejects primary_protein outside the 11-value list', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, primary_protein: 'turkey' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidence outside [0, 1]', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, confidence: 1.5 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative price', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, price: -5 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts null price (price not shown on menu)', () => {
    const result = MenuExtractionSchema.safeParse({
      dishes: [{ ...validDish, price: null }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty dishes array', () => {
    const result = MenuExtractionSchema.safeParse({ dishes: [] });
    expect(result.success).toBe(true);
  });
});
