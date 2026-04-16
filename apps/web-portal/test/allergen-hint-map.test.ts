import { describe, it, expect } from 'vitest';
import { ALLERGENS } from '@eatme/shared';
import { mapAllergenHints, normalizeAllergenHint } from '../lib/menu-scan';

const canonicalCodes = new Set<string>(ALLERGENS.map(a => a.value));

describe('mapAllergenHints', () => {
  it('every mapped alias resolves to a code in canonical ALLERGENS', () => {
    const aliasProbes = [
      // Direct canonical
      'lactose',
      'gluten',
      'peanuts',
      'nuts',
      'soy',
      'sesame',
      'eggs',
      'fish',
      'shellfish',
      // Common synonyms
      'dairy',
      'milk',
      'butter',
      'wheat',
      'barley',
      'peanut',
      'groundnut',
      'almond',
      'walnut',
      'cashew',
      'pistachio',
      'tree nuts',
      'soya',
      'tofu',
      'edamame',
      'tahini',
      'egg',
      'mayo',
      'aioli',
      'salmon',
      'tuna',
      'anchovy',
      'shrimp',
      'crab',
      'lobster',
      'oyster',
      'calamari',
    ];
    for (const alias of aliasProbes) {
      const { codes } = mapAllergenHints([alias]);
      expect(codes.length, `alias "${alias}" produced no codes`).toBeGreaterThan(0);
      for (const code of codes) {
        expect(
          canonicalCodes.has(code),
          `code "${code}" from alias "${alias}" is not in canonical ALLERGENS`
        ).toBe(true);
      }
    }
  });

  it('keeps finfish and shellfish distinct', () => {
    expect(mapAllergenHints(['salmon']).codes).toEqual(['fish']);
    expect(mapAllergenHints(['shrimp']).codes).toEqual(['shellfish']);
    expect(mapAllergenHints(['anchovy']).codes).toEqual(['fish']);
    expect(mapAllergenHints(['octopus']).codes).toEqual(['shellfish']);
  });

  it('peanuts and tree nuts are distinct', () => {
    expect(mapAllergenHints(['peanut']).codes).toEqual(['peanuts']);
    expect(mapAllergenHints(['almond']).codes).toEqual(['nuts']);
    const both = mapAllergenHints(['peanut', 'walnut']).codes.sort();
    expect(both).toEqual(['nuts', 'peanuts']);
  });

  it('surfaces unmapped hints instead of silently dropping them', () => {
    const { codes, unmapped } = mapAllergenHints(['salmon', 'chickpea flour', '  ']);
    expect(codes).toEqual(['fish']);
    expect(unmapped).toEqual(['chickpea flour']);
  });

  it('strips common noise prefixes before lookup', () => {
    expect(normalizeAllergenHint('Contains: Peanuts')).toBe('peanuts');
    expect(normalizeAllergenHint('w/ almonds')).toBe('almonds');
    expect(normalizeAllergenHint('* egg')).toBe('egg');
    expect(normalizeAllergenHint('(shrimp)')).toBe('shrimp');
  });

  it('deduplicates across synonyms that map to the same code', () => {
    const { codes } = mapAllergenHints(['shrimp', 'prawn', 'crab']);
    expect(codes).toEqual(['shellfish']);
  });
});
