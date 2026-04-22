import { describe, it, expect } from 'vitest';
import { DISH_KIND_META } from '../constants/menu';
import { LEGACY_DISH_KINDS, isLegacyKind } from '../types/restaurant';

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

describe('isLegacyKind', () => {
  it('returns true for combo', () => {
    expect(isLegacyKind('combo')).toBe(true);
  });

  it('returns true for template', () => {
    expect(isLegacyKind('template')).toBe(true);
  });

  it('returns true for experience', () => {
    expect(isLegacyKind('experience')).toBe(true);
  });

  it('returns false for bundle', () => {
    expect(isLegacyKind('bundle')).toBe(false);
  });

  it('returns false for standard', () => {
    expect(isLegacyKind('standard')).toBe(false);
  });

  it('returns false for unknown string', () => {
    expect(isLegacyKind('unknown_future_value')).toBe(false);
  });
});

describe('LEGACY_DISH_KINDS', () => {
  it('contains exactly 3 values', () => {
    expect(LEGACY_DISH_KINDS).toHaveLength(3);
  });

  it('contains template, experience, combo', () => {
    expect(LEGACY_DISH_KINDS).toContain('template');
    expect(LEGACY_DISH_KINDS).toContain('experience');
    expect(LEGACY_DISH_KINDS).toContain('combo');
  });
});
