import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders when open=true', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete Restaurant"
        description="This action cannot be undone."
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Delete Restaurant')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Delete Restaurant"
        description="This action cannot be undone."
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByText('Delete Restaurant')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={onConfirm}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onOpenChange(false) when cancel clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete Item"
        description="Are you sure?"
        onConfirm={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows custom confirm label', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Remove"
        description="Sure?"
        confirmLabel="Remove Forever"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Remove Forever' })).toBeInTheDocument();
  });
});
