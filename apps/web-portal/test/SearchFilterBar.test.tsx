import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchFilterBar } from '@/components/SearchFilterBar';

describe('SearchFilterBar', () => {
  it('renders search input with placeholder', () => {
    render(
      <SearchFilterBar
        search={{ value: '', onChange: vi.fn(), placeholder: 'Search restaurants...' }}
      />
    );
    expect(screen.getByPlaceholderText('Search restaurants...')).toBeTruthy();
  });

  it('uses default placeholder when none provided', () => {
    render(
      <SearchFilterBar search={{ value: '', onChange: vi.fn() }} />
    );
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('calls onChange when search input changes', () => {
    const onChange = vi.fn();
    render(
      <SearchFilterBar search={{ value: '', onChange, placeholder: 'Search...' }} />
    );
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'pizza' } });
    expect(onChange).toHaveBeenCalledWith('pizza');
  });

  it('renders filters when provided', () => {
    render(
      <SearchFilterBar
        search={{ value: '', onChange: vi.fn() }}
        filters={[
          {
            label: 'Status',
            value: '',
            onChange: vi.fn(),
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ],
          },
        ]}
      />
    );
    expect(screen.getByText('Status')).toBeTruthy();
  });

  it('renders actions slot', () => {
    render(
      <SearchFilterBar
        search={{ value: '', onChange: vi.fn() }}
        actions={<button>New Restaurant</button>}
      />
    );
    expect(screen.getByText('New Restaurant')).toBeTruthy();
  });

  it('does not render actions slot when not provided', () => {
    render(
      <SearchFilterBar search={{ value: '', onChange: vi.fn() }} />
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders current search value in input', () => {
    render(
      <SearchFilterBar
        search={{ value: 'burger', onChange: vi.fn(), placeholder: 'Search...' }}
      />
    );
    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
    expect(input.value).toBe('burger');
  });
});
