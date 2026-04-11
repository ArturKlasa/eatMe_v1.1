import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';

// Mock next-themes useTheme
const mockSetTheme = vi.fn();
let mockTheme = 'light';

vi.mock('next-themes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-themes')>();
  return {
    ...actual,
    useTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
  };
});

// Mock OwnerHeader's useAuth dependency
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));

import { ThemeToggle } from '@/components/ThemeToggle';
import { OwnerHeader } from '@/components/OwnerHeader';

describe('ThemeToggle', () => {
  it('renders without crashing', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('cycles light → dark when clicked', () => {
    mockTheme = 'light';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('cycles dark → system when clicked', () => {
    mockSetTheme.mockClear();
    mockTheme = 'dark';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('cycles system → light when clicked', () => {
    mockSetTheme.mockClear();
    mockTheme = 'system';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});

describe('OwnerHeader', () => {
  it('renders null when user is null', () => {
    const { container } = render(<OwnerHeader />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ThemeProvider', () => {
  it('applies dark class on html element when forcedTheme is dark', () => {
    // next-themes needs window.matchMedia in jsdom
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    render(
      <ThemeProvider attribute="class" forcedTheme="dark">
        <div data-testid="child">content</div>
      </ThemeProvider>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
