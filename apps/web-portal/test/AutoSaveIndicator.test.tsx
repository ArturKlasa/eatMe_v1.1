import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AutoSaveIndicator } from '@/components/onboarding/AutoSaveIndicator';

describe('AutoSaveIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when not saving and no lastSaved', () => {
    const { container } = render(
      <AutoSaveIndicator lastSaved={null} saving={false} />
    );
    expect(container.textContent).toBe('');
  });

  it('shows "Saving..." when saving is true', () => {
    render(<AutoSaveIndicator lastSaved={null} saving={true} />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows timestamp after saving completes', () => {
    const savedTime = new Date(2026, 3, 9, 14, 30);
    render(<AutoSaveIndicator lastSaved={savedTime} saving={false} />);
    expect(screen.getByText(/Draft saved at/)).toBeInTheDocument();
  });

  it('applies fade animation class', () => {
    const savedTime = new Date(2026, 3, 9, 14, 30);
    const { container } = render(
      <AutoSaveIndicator lastSaved={savedTime} saving={false} />
    );

    // Initially visible with fade animation class
    expect(screen.getByText(/Draft saved at/)).toBeInTheDocument();
    const span = container.querySelector('span');
    expect(span?.className).toContain('animate-auto-save-fade');
  });

  it('resets visibility when saving starts again', () => {
    const { rerender } = render(
      <AutoSaveIndicator lastSaved={new Date()} saving={false} />
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Start saving again
    rerender(<AutoSaveIndicator lastSaved={new Date()} saving={true} />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });
});
