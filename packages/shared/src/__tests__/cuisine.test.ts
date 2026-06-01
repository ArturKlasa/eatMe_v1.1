import { describe, it, expect } from 'vitest';
import { normalizeCuisines, ALL_CUISINES } from '../constants/cuisine';

describe('normalizeCuisines', () => {
  it('canonicalizes accent/case/whitespace variants', () => {
    expect(normalizeCuisines(['cafe'])).toEqual(['Café']);
    expect(normalizeCuisines(['CAFÉ'])).toEqual(['Café']);
    expect(normalizeCuisines(['  café '])).toEqual(['Café']);
    expect(normalizeCuisines(['fast food'])).toEqual(['Fast Food']);
  });

  it('keeps canonical values as-is', () => {
    expect(normalizeCuisines(['Italian', 'Thai', 'Latin American'])).toEqual([
      'Italian',
      'Thai',
      'Latin American',
    ]);
  });

  it('drops unknown values', () => {
    expect(normalizeCuisines(['Italian', 'NotACuisine'])).toEqual(['Italian']);
  });

  it('deduplicates while preserving first-seen order', () => {
    expect(normalizeCuisines(['Thai', 'thai', 'THAI'])).toEqual(['Thai']);
    expect(normalizeCuisines(['Pizza', 'Italian', 'pizza'])).toEqual(['Pizza', 'Italian']);
  });

  it('handles null/undefined/non-string input safely', () => {
    expect(normalizeCuisines(null)).toEqual([]);
    expect(normalizeCuisines(undefined)).toEqual([]);
    expect(normalizeCuisines([1, 2] as unknown as string[])).toEqual([]);
  });

  it('maps every canonical value to itself', () => {
    for (const c of ALL_CUISINES) {
      expect(normalizeCuisines([c])).toEqual([c]);
    }
  });
});
