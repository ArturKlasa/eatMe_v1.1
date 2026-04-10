import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '@/components/PageHeader';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<PageHeader title="Dashboard" description="Overview of your restaurants" />);
    expect(screen.getByText('Overview of your restaurants')).toBeInTheDocument();
  });

  it('renders breadcrumbs when provided', () => {
    render(
      <PageHeader
        title="Edit"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Restaurants', href: '/admin/restaurants' },
          { label: 'Edit' },
        ]}
      />
    );
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Restaurants')).toBeInTheDocument();
    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
  });

  it('renders back link when backHref set', () => {
    render(<PageHeader title="Details" backHref="/admin" />);
    expect(screen.getByLabelText('Go back')).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    render(
      <PageHeader
        title="Restaurants"
        actions={<button>Add Restaurant</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Add Restaurant' })).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(<PageHeader title="Restaurant" badge={{ label: 'Active', variant: 'success' }} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
