import { describe, it, expect } from 'vitest';
import { DIETARY_TAGS } from '@eatme/shared';
import { mapDietaryHints, normalizeDietaryHint } from '../lib/menu-scan';

const canonicalCodes = new Set<string>(DIETARY_TAGS.map(t => t.value));

describe('mapDietaryHints', () => {
  it('maps all known aliases to codes that exist in the canonical DIETARY_TAGS list', () => {
    // Broad coverage probe: every alias observed in DIETARY_HINT_MAP must resolve
    // to a canonical code. If this fails, the map has drifted from the shared list.
    const aliasProbes = [
      'vegetarian',
      'v',
      'vegano',
      'vg',
      'gluten-free',
      'gf',
      'halal',
      'kosher',
      'dairy-free',
      'nut-free',
      'organic',
      'egg-free',
      'soy-free',
      'paleo',
      'keto',
      'low-sodium',
      'pescatarian',
      '🌿',
      '🌱',
      '♻️',
    ];
    for (const alias of aliasProbes) {
      const { codes } = mapDietaryHints([alias]);
      expect(codes.length, `alias "${alias}" produced no codes`).toBeGreaterThan(0);
      for (const code of codes) {
        expect(
          canonicalCodes.has(code),
          `code "${code}" from alias "${alias}" is not in DIETARY_TAGS`
        ).toBe(true);
      }
    }
  });

  it('surfaces unmapped hints instead of silently dropping them', () => {
    const { codes, unmapped } = mapDietaryHints(['vegetarian', 'made-up-diet', '  ']);
    expect(codes).toContain('vegetarian');
    expect(unmapped).toEqual(['made-up-diet']);
  });

  it('vegan implies vegetarian', () => {
    const { codes } = mapDietaryHints(['vegan']);
    expect(codes).toContain('vegan');
    expect(codes).toContain('vegetarian');
  });

  it('normalizeDietaryHint strips brackets, asterisks, periods, and lowercases', () => {
    expect(normalizeDietaryHint('[V]')).toBe('v');
    expect(normalizeDietaryHint('(Vegan)*')).toBe('vegan');
    expect(normalizeDietaryHint('G.F.')).toBe('gf');
  });
});
