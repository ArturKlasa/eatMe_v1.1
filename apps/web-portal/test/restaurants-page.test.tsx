import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, className, title, 'aria-label': ariaLabel }: {
    href: string; children: React.ReactNode; className?: string; title?: string; 'aria-label'?: string;
  }) => (
    <a href={href} className={className} title={title} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

// Mock import-service
vi.mock('@/lib/import-service', () => ({
  computeWarningFlags: vi.fn(() => []),
}));

const restaurants = [
  {
    id: 'r1',
    name: 'The Green Bistro',
    address: '10 Main St',
    cuisine_types: ['Italian', 'Mediterranean'],
    is_active: true,
    suspended_at: null,
    suspension_reason: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'r2',
    name: 'Spice Garden',
    address: '20 Oak Ave',
    cuisine_types: ['Indian'],
    is_active: false,
    suspended_at: '2024-02-01T00:00:00Z',
    suspension_reason: 'Health code violation',
    created_at: '2024-01-15T00:00:00Z',
  },
  {
    id: 'r3',
    name: 'Ocean Pearl',
    address: '30 Sea Blvd',
    cuisine_types: ['Seafood'],
    is_active: true,
    suspended_at: null,
    suspension_reason: null,
    created_at: '2024-01-20T00:00:00Z',
  },
];

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'restaurants') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: restaurants, error: null }),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'dishes') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

import RestaurantsPage from '@/app/admin/restaurants/page';

describe('AdminRestaurantsPage — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and all restaurant names', async () => {
    render(<RestaurantsPage />);
    await waitFor(() => expect(screen.getByText('The Green Bistro')).toBeInTheDocument());
    expect(screen.getByText('Spice Garden')).toBeInTheDocument();
    expect(screen.getByText('Ocean Pearl')).toBeInTheDocument();
  });

  it('shows active restaurants with Active status badge', async () => {
    render(<RestaurantsPage />);
    await waitFor(() => expect(screen.getAllByText('Active').length).toBeGreaterThan(0));
  });

  it('shows suspended restaurants with Suspended status badge', async () => {
    render(<RestaurantsPage />);
    await waitFor(() => expect(screen.getByText('Suspended')).toBeInTheDocument());
  });

  it('filters restaurants by search query', async () => {
    const user = userEvent.setup();
    render(<RestaurantsPage />);
    await waitFor(() => expect(screen.getByText('The Green Bistro')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search restaurants...');
    await user.type(searchInput, 'spice');

    expect(screen.queryByText('The Green Bistro')).not.toBeInTheDocument();
    expect(screen.getByText('Spice Garden')).toBeInTheDocument();
    expect(screen.queryByText('Ocean Pearl')).not.toBeInTheDocument();
  });

  it('renders status filter select on the page', async () => {
    render(<RestaurantsPage />);
    await waitFor(() => expect(screen.getByText('The Green Bistro')).toBeInTheDocument());
    // Status filter combobox should be present
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders scan menu action link for each restaurant', async () => {
    render(<RestaurantsPage />);
    await waitFor(() => expect(screen.getByText('The Green Bistro')).toBeInTheDocument());

    const scanLinks = screen.getAllByTitle('Scan Menu');
    expect(scanLinks.length).toBe(3);
    expect(scanLinks[0]).toHaveAttribute('href', '/admin/menu-scan?restaurant_id=r1');
  });

  it('uses semantic token classes for scan menu link (no hardcoded purple)', async () => {
    render(<RestaurantsPage />);
    await waitFor(() => expect(screen.getByText('The Green Bistro')).toBeInTheDocument());

    const scanLinks = screen.getAllByTitle('Scan Menu');
    scanLinks.forEach(link => {
      expect(link.className).not.toMatch(/purple/);
    });
  });

  it('uses semantic token classes for suspend button (no hardcoded yellow)', async () => {
    render(<RestaurantsPage />);
    await waitFor(() => expect(screen.getByText('The Green Bistro')).toBeInTheDocument());

    const suspendBtns = screen.getAllByTitle('Suspend');
    suspendBtns.forEach(btn => {
      expect(btn.className).not.toMatch(/yellow/);
    });
  });
});
