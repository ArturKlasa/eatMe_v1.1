import { describe, it, expect } from 'vitest';

describe('Button export', () => {
  it('exports Button without throwing', async () => {
    const mod = await import('../components/ui/button');
    expect(mod.Button).toBeDefined();
    expect(typeof mod.Button).toBe('object'); // forwardRef returns object
  });

  it('exports buttonVariants', async () => {
    const mod = await import('../components/ui/button');
    expect(mod.buttonVariants).toBeDefined();
    expect(typeof mod.buttonVariants).toBe('function');
  });

  it('exports cn from lib/utils', async () => {
    const mod = await import('../lib/utils');
    expect(typeof mod.cn).toBe('function');
    expect(mod.cn('foo', 'bar')).toBe('foo bar');
  });
});
