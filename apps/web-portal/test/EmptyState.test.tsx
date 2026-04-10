import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

describe('EmptyState', () => {
  it('renders icon, title, and description', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No restaurants"
        description="Get started by adding your first restaurant."
      />
    );
    expect(screen.getByText('No restaurants')).toBeInTheDocument();
    expect(screen.getByText('Get started by adding your first restaurant.')).toBeInTheDocument();
  });

  it('renders CTA button with onClick action', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Inbox}
        title="No items"
        description="Nothing here yet."
        action={{ label: 'Add Item', onClick }}
      />
    );
    const button = screen.getByRole('button', { name: 'Add Item' });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders CTA link with href action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No items"
        description="Nothing here yet."
        action={{ label: 'Go Home', href: '/' }}
      />
    );
    const link = screen.getByRole('link', { name: 'Go Home' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('does not render CTA when no action provided', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Empty"
        description="Nothing here."
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
