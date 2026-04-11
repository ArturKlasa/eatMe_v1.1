import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatusBadge, type StatusVariant } from '@/components/StatusBadge';

const ALL_VARIANTS: StatusVariant[] = ['active', 'inactive', 'pending', 'error', 'warning', 'draft'];

describe('StatusBadge', () => {
  it.each(ALL_VARIANTS)('renders %s variant with default label', (variant) => {
    const { getByText } = render(<StatusBadge variant={variant} />);
    expect(getByText(variant.charAt(0).toUpperCase() + variant.slice(1))).toBeTruthy();
  });

  it('renders custom label override', () => {
    const { getByText } = render(<StatusBadge variant="active" label="Live" />);
    expect(getByText('Live')).toBeTruthy();
  });

  it('renders sm size', () => {
    const { container } = render(<StatusBadge variant="active" size="sm" />);
    const dot = container.querySelector('.h-1\\.5');
    expect(dot).toBeTruthy();
  });

  it('renders md size (default)', () => {
    const { container } = render(<StatusBadge variant="active" size="md" />);
    const dot = container.querySelector('.h-2');
    expect(dot).toBeTruthy();
  });

  it('applies success color for active variant', () => {
    const { container } = render(<StatusBadge variant="active" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-success');
  });

  it('applies destructive color for error variant', () => {
    const { container } = render(<StatusBadge variant="error" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('text-destructive');
  });
});
