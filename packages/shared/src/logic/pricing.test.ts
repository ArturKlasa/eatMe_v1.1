import { describe, it, expect } from 'vitest';
import { deriveSizeFromPrice } from './pricing';

describe('deriveSizeFromPrice', () => {
  const sizeGroup = {
    selection_type: 'single' as const,
    min_selections: 1,
    options: [
      { name: 'Chica', price_delta: 90, price_override: null },
      { name: 'Mediana', price_delta: 120, price_override: null },
      { name: 'Grande', price_delta: 150, price_override: null },
    ],
  };

  it('returns the cheapest size for a null-price dish with a required size group (delta-priced)', () => {
    expect(deriveSizeFromPrice(null, [sizeGroup])).toBe(90);
  });

  it('returns the cheapest size when the group is override-priced', () => {
    const overrideGroup = {
      selection_type: 'single' as const,
      min_selections: 1,
      options: [
        { name: 'Chica', price_delta: 0, price_override: 90 },
        { name: 'Grande', price_delta: 0, price_override: 150 },
      ],
    };
    expect(deriveSizeFromPrice(null, [overrideGroup])).toBe(90);
  });

  it('returns null when the dish already has its own price', () => {
    expect(deriveSizeFromPrice(120, [sizeGroup])).toBeNull();
  });

  it('returns null for a based-price dish with a +$3 protein upgrade', () => {
    const upgrade = {
      selection_type: 'single' as const,
      min_selections: 1,
      options: [
        { name: 'Chicken', price_delta: 0, price_override: null },
        { name: 'Shrimp', price_delta: 3, price_override: null },
      ],
    };
    // base price is set → not a size-priced dish
    expect(deriveSizeFromPrice(14, [upgrade])).toBeNull();
  });

  it('returns null for an optional add-on group (min_selections 0)', () => {
    const addons = {
      selection_type: 'single' as const,
      min_selections: 0,
      options: [
        { name: 'Bacon', price_delta: 20, price_override: null },
        { name: 'Egg', price_delta: 15, price_override: null },
      ],
    };
    expect(deriveSizeFromPrice(null, [addons])).toBeNull();
  });

  it('returns null when more than one group qualifies (ambiguous)', () => {
    expect(deriveSizeFromPrice(null, [sizeGroup, sizeGroup])).toBeNull();
  });

  it('returns null for a multiple-select group', () => {
    const multi = { ...sizeGroup, selection_type: 'multiple' as const };
    expect(deriveSizeFromPrice(null, [multi])).toBeNull();
  });

  it('returns null when a single option has no price (mixed/included)', () => {
    const mixed = {
      selection_type: 'single' as const,
      min_selections: 1,
      options: [
        { name: 'Regular', price_delta: 0, price_override: null }, // included, no price
        { name: 'Large', price_delta: 30, price_override: null },
      ],
    };
    expect(deriveSizeFromPrice(null, [mixed])).toBeNull();
  });

  it('returns null for a single-option group (not a real size choice)', () => {
    const lone = {
      selection_type: 'single' as const,
      min_selections: 1,
      options: [{ name: 'Only', price_delta: 90, price_override: null }],
    };
    expect(deriveSizeFromPrice(null, [lone])).toBeNull();
  });

  it('returns null for null/empty groups', () => {
    expect(deriveSizeFromPrice(null, null)).toBeNull();
    expect(deriveSizeFromPrice(null, [])).toBeNull();
  });
});
