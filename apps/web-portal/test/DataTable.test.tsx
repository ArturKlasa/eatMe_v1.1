import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type ColumnDef } from '@/components/DataTable';

interface Row {
  id: number;
  name: string;
  status: string;
}

const COLUMNS: ColumnDef<Row>[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'status', header: 'Status' },
];

const DATA: Row[] = [
  { id: 1, name: 'Alice', status: 'active' },
  { id: 2, name: 'Bob', status: 'inactive' },
  { id: 3, name: 'Carol', status: 'pending' },
];

describe('DataTable', () => {
  it('renders correct number of rows', () => {
    const { container } = render(<DataTable data={DATA as Record<string, unknown>[]} columns={COLUMNS as ColumnDef<Record<string, unknown>>[]} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
  });

  it('renders column headers', () => {
    render(<DataTable data={DATA as Record<string, unknown>[]} columns={COLUMNS as ColumnDef<Record<string, unknown>>[]} />);
    expect(screen.getByText('ID')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
  });

  it('renders cell values from data', () => {
    render(<DataTable data={DATA as Record<string, unknown>[]} columns={COLUMNS as ColumnDef<Record<string, unknown>>[]} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('renders custom cell with render function', () => {
    const columns: ColumnDef<Record<string, unknown>>[] = [
      { key: 'name', header: 'Name', render: (value) => <strong>{String(value)}-custom</strong> },
    ];
    render(<DataTable data={DATA as Record<string, unknown>[]} columns={columns} />);
    expect(screen.getByText('Alice-custom')).toBeTruthy();
  });

  it('shows loading skeleton when loading=true', () => {
    const { container } = render(
      <DataTable
        data={DATA as Record<string, unknown>[]}
        columns={COLUMNS as ColumnDef<Record<string, unknown>>[]}
        loading={true}
      />
    );
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('.rounded-lg')).toBeTruthy();
  });

  it('shows default empty state when data is empty', () => {
    render(
      <DataTable
        data={[]}
        columns={COLUMNS as ColumnDef<Record<string, unknown>>[]}
      />
    );
    expect(screen.getByText('No items found.')).toBeTruthy();
  });

  it('shows custom emptyState when data is empty', () => {
    render(
      <DataTable
        data={[]}
        columns={COLUMNS as ColumnDef<Record<string, unknown>>[]}
        emptyState={<div>Custom empty</div>}
      />
    );
    expect(screen.getByText('Custom empty')).toBeTruthy();
  });

  it('renders actions column per row', () => {
    const actions = vi.fn((row: Record<string, unknown>) => (
      <button>Edit {String(row.name)}</button>
    ));
    render(
      <DataTable
        data={DATA as Record<string, unknown>[]}
        columns={COLUMNS as ColumnDef<Record<string, unknown>>[]}
        actions={actions}
      />
    );
    expect(screen.getByText('Edit Alice')).toBeTruthy();
    expect(screen.getByText('Edit Bob')).toBeTruthy();
    expect(actions).toHaveBeenCalledTimes(3);
  });

  it('calls onRowClick when row is clicked', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        data={DATA as Record<string, unknown>[]}
        columns={COLUMNS as ColumnDef<Record<string, unknown>>[]}
        onRowClick={onRowClick}
      />
    );
    await userEvent.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(DATA[0]);
  });

  it('renders pagination when pagination prop is provided with totalPages > 1', () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <DataTable
        data={DATA as Record<string, unknown>[]}
        columns={COLUMNS as ColumnDef<Record<string, unknown>>[]}
        pagination={{ page: 1, totalPages: 5, onPageChange }}
      />
    );
    // Pagination nav should be present
    const paginationLinks = container.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  });

  it('calls onPageChange when pagination link is clicked', async () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <DataTable
        data={DATA as Record<string, unknown>[]}
        columns={COLUMNS as ColumnDef<Record<string, unknown>>[]}
        pagination={{ page: 1, totalPages: 5, onPageChange }}
      />
    );
    const paginationLinks = container.querySelectorAll('[data-slot="pagination-link"]');
    await userEvent.click(paginationLinks[1] as HTMLElement); // click second page link
    expect(onPageChange).toHaveBeenCalled();
  });

  it('does not render pagination when totalPages <= 1', () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <DataTable
        data={DATA as Record<string, unknown>[]}
        columns={COLUMNS as ColumnDef<Record<string, unknown>>[]}
        pagination={{ page: 1, totalPages: 1, onPageChange }}
      />
    );
    expect(container.querySelector('nav[aria-label]')).toBeNull();
  });
});
