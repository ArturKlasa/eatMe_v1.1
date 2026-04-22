import { describe, it, expect } from 'vitest';
import { DISH_KIND_META } from '../constants/menu';

describe('DISH_KIND_META', () => {
  it('has exactly 5 entries', () => {
    expect(Object.keys(DISH_KIND_META)).toHaveLength(5);
  });

  it('contains all canonical kind keys', () => {
    const keys = Object.keys(DISH_KIND_META);
    expect(keys).toContain('standard');
    expect(keys).toContain('bundle');
    expect(keys).toContain('configurable');
    expect(keys).toContain('course_menu');
    expect(keys).toContain('buffet');
  });

  it('each entry has label, description, and icon', () => {
    for (const [, meta] of Object.entries(DISH_KIND_META)) {
      expect(typeof meta.label).toBe('string');
      expect(typeof meta.description).toBe('string');
      expect(typeof meta.icon).toBe('string');
    }
  });

  it('bundle label is Bundle', () => {
    expect(DISH_KIND_META['bundle'].label).toBe('Bundle');
  });
});

// KIND_BADGE logic used in apps/mobile/src/components/DishPhotoModal.tsx
const KIND_BADGE: Record<string, string> = {
  configurable: '  🔧',
  course_menu: '  🍷',
  buffet: '  🍱',
  bundle: '  🎁',
};

describe('KIND_BADGE (mobile DishPhotoModal badge logic)', () => {
  it('returns the right badge for configurable', () => {
    expect(KIND_BADGE['configurable'] ?? '').toBe('  🔧');
  });

  it('returns the right badge for course_menu', () => {
    expect(KIND_BADGE['course_menu'] ?? '').toBe('  🍷');
  });

  it('returns the right badge for buffet', () => {
    expect(KIND_BADGE['buffet'] ?? '').toBe('  🍱');
  });

  it('returns the right badge for bundle', () => {
    expect(KIND_BADGE['bundle'] ?? '').toBe('  🎁');
  });

  it('returns empty string for standard (no badge)', () => {
    expect(KIND_BADGE['standard'] ?? '').toBe('');
  });

  it('returns empty string for unknown kind (no crash)', () => {
    expect(KIND_BADGE['unknown_future_value'] ?? '').toBe('');
  });

  it('badge icons match DISH_KIND_META icons for badged kinds', () => {
    const badgedKinds = ['configurable', 'course_menu', 'buffet', 'bundle'] as const;
    for (const kind of badgedKinds) {
      const meta = DISH_KIND_META[kind];
      expect(KIND_BADGE[kind]).toBe(`  ${meta.icon}`);
    }
  });
});
