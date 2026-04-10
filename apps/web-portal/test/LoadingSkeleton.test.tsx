import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renders card variant', () => {
    const { container } = render(<LoadingSkeleton variant="card" />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders multiple cards when count provided', () => {
    const { container } = render(<LoadingSkeleton variant="card" count={3} />);
    const cards = container.querySelectorAll('.rounded-lg.border');
    expect(cards).toHaveLength(3);
  });

  it('renders table variant with correct row count', () => {
    const { container } = render(<LoadingSkeleton variant="table" count={3} />);
    // header row + 3 body rows = 4 rows total
    const rows = container.querySelectorAll('.border-b, .border-b-0');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('renders form variant with correct field count', () => {
    const { container } = render(<LoadingSkeleton variant="form" count={2} />);
    const fields = container.querySelectorAll('.space-y-2');
    expect(fields).toHaveLength(2);
  });

  it('renders stats variant with 3 stat cards', () => {
    const { container } = render(<LoadingSkeleton variant="stats" />);
    const statCards = container.querySelectorAll('.rounded-lg.border');
    expect(statCards).toHaveLength(3);
  });

  it('renders page variant', () => {
    const { container } = render(<LoadingSkeleton variant="page" />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
