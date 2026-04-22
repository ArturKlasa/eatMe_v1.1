import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlaggedDuplicatePanel } from '../FlaggedDuplicatePanel';
import type { FlaggedDuplicate, RawExtractedDish } from '@/lib/menu-scan';

function makeDish(overrides: Partial<RawExtractedDish> = {}): RawExtractedDish {
  return {
    name: 'Salmon Teriyaki',
    price: 150,
    description: 'Grilled salmon with teriyaki sauce',
    raw_ingredients: null,
    dietary_hints: [],
    allergen_hints: [],
    spice_level: null,
    calories: null,
    dish_category: null,
    dish_kind: 'standard',
    is_parent: false,
    confidence: 0.9,
    serves: null,
    display_price_prefix: 'exact',
    variants: null,
    ...overrides,
  };
}

function makeDuplicate(overrides: Partial<FlaggedDuplicate> = {}): FlaggedDuplicate {
  return {
    existingDish: makeDish({ price: 150 }),
    incomingDish: makeDish({ price: 200 }),
    categoryName: 'Mains',
    similarity: 1,
    reasons: ['name 100% match', 'same category'],
    ...overrides,
  };
}

describe('FlaggedDuplicatePanel', () => {
  it('renders the reasons from the duplicate', () => {
    render(
      <FlaggedDuplicatePanel
        duplicate={makeDuplicate()}
        onGroupTogether={vi.fn()}
        onKeepSeparate={vi.fn()}
      />
    );
    expect(screen.getByText(/name 100% match, same category/)).toBeInTheDocument();
  });

  it('renders existing and incoming dish columns', () => {
    render(
      <FlaggedDuplicatePanel
        duplicate={makeDuplicate()}
        onGroupTogether={vi.fn()}
        onKeepSeparate={vi.fn()}
      />
    );
    expect(screen.getByText('Existing dish')).toBeInTheDocument();
    expect(screen.getByText('Incoming dish')).toBeInTheDocument();
  });

  it('shows both dish prices', () => {
    render(
      <FlaggedDuplicatePanel
        duplicate={makeDuplicate()}
        onGroupTogether={vi.fn()}
        onKeepSeparate={vi.fn()}
      />
    );
    expect(screen.getByText('$150')).toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
  });

  it('calls onGroupTogether when "Group together" is clicked', () => {
    const onGroup = vi.fn();
    render(
      <FlaggedDuplicatePanel
        duplicate={makeDuplicate()}
        onGroupTogether={onGroup}
        onKeepSeparate={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Group together'));
    expect(onGroup).toHaveBeenCalledOnce();
  });

  it('calls onKeepSeparate when "Keep separate" is clicked', () => {
    const onKeep = vi.fn();
    render(
      <FlaggedDuplicatePanel
        duplicate={makeDuplicate()}
        onGroupTogether={vi.fn()}
        onKeepSeparate={onKeep}
      />
    );
    fireEvent.click(screen.getByText('Keep separate'));
    expect(onKeep).toHaveBeenCalledOnce();
  });

  it('shows description when present', () => {
    render(
      <FlaggedDuplicatePanel
        duplicate={makeDuplicate()}
        onGroupTogether={vi.fn()}
        onKeepSeparate={vi.fn()}
      />
    );
    // Both dishes share the same description in this fixture — appears at least once
    expect(screen.getAllByText('Grilled salmon with teriyaki sauce').length).toBeGreaterThan(0);
  });

  it('renders multiple reasons joined by comma', () => {
    const dup = makeDuplicate({
      reasons: ['name 87% match', 'same category', 'description overlap'],
    });
    render(
      <FlaggedDuplicatePanel duplicate={dup} onGroupTogether={vi.fn()} onKeepSeparate={vi.fn()} />
    );
    expect(
      screen.getByText(/name 87% match, same category, description overlap/)
    ).toBeInTheDocument();
  });
});
