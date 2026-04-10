import { describe, it, expect } from 'vitest';
import { getStepFromPathname } from '@/app/onboard/layout';

describe('getStepFromPathname', () => {
  it('returns 1 for /onboard/basic-info', () => {
    expect(getStepFromPathname('/onboard/basic-info')).toBe(1);
  });

  it('returns 2 for /onboard/menu', () => {
    expect(getStepFromPathname('/onboard/menu')).toBe(2);
  });

  it('returns 3 for /onboard/review', () => {
    expect(getStepFromPathname('/onboard/review')).toBe(3);
  });

  it('returns 1 for unknown /onboard/ paths', () => {
    expect(getStepFromPathname('/onboard')).toBe(1);
    expect(getStepFromPathname('/onboard/something-else')).toBe(1);
  });
});
