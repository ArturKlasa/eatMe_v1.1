/**
 * Step 20 — Badge size variants
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Badge, badgeVariants } from '@/components/ui/badge';

describe('Badge size variants', () => {
  it('renders sm size with correct classes', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('px-1.5');
    expect(badge.className).toContain('text-[10px]');
  });

  it('renders md size with correct classes (default)', () => {
    const { container } = render(<Badge size="md">Medium</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('px-2.5');
    expect(badge.className).toContain('text-xs');
  });

  it('renders lg size with correct classes', () => {
    const { container } = render(<Badge size="lg">Large</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('px-3');
    expect(badge.className).toContain('text-sm');
  });

  it('defaults to md size when no size specified', () => {
    const classes = badgeVariants({});
    expect(classes).toContain('px-2.5');
  });

  it('sm size has smaller font than md', () => {
    const smClasses = badgeVariants({ size: 'sm' });
    const mdClasses = badgeVariants({ size: 'md' });
    expect(smClasses).toContain('text-[10px]');
    expect(mdClasses).toContain('text-xs');
  });

  it('renders all variants with default (md) size', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline'] as const;
    for (const variant of variants) {
      const { container } = render(<Badge variant={variant}>Badge</Badge>);
      expect(container.firstChild).toBeTruthy();
    }
  });
});
