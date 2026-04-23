import { describe, it, expect } from 'vitest';

describe('OnboardingStepper export', () => {
  it('exports OnboardingStepper', async () => {
    const mod = await import('../compose/OnboardingStepper');
    expect(mod.OnboardingStepper).toBeDefined();
    expect(typeof mod.OnboardingStepper).toBe('function');
  });

  it('re-exports OnboardingStepper from index', async () => {
    const mod = await import('../index');
    expect(mod.OnboardingStepper).toBeDefined();
    expect(typeof mod.OnboardingStepper).toBe('function');
  });
});
