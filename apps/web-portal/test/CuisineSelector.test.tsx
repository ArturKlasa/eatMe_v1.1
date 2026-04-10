import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CuisineSelector } from '@/components/forms/CuisineSelector';

describe('CuisineSelector', () => {
  it('renders selected cuisines as badges', () => {
    render(<CuisineSelector selected={['Italian', 'Mexican']} onChange={() => {}} />);
    // Both appear in badges and in popular grid, so check for remove buttons
    expect(screen.getByLabelText('Remove Italian')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Mexican')).toBeInTheDocument();
  });

  it('clicking cuisine toggles selection (adds)', async () => {
    const onChange = vi.fn();
    render(<CuisineSelector selected={[]} onChange={onChange} />);
    // Popular cuisines are shown by default; click Italian checkbox
    const italianCheckbox = screen.getByLabelText('Italian');
    await userEvent.click(italianCheckbox);
    expect(onChange).toHaveBeenCalledWith(['Italian']);
  });

  it('clicking selected cuisine removes it', async () => {
    const onChange = vi.fn();
    render(<CuisineSelector selected={['Italian', 'Mexican']} onChange={onChange} />);
    // Click Italian checkbox to deselect
    const italianCheckbox = screen.getByLabelText('Italian');
    await userEvent.click(italianCheckbox);
    expect(onChange).toHaveBeenCalledWith(['Mexican']);
  });

  it('search filters the cuisine grid', async () => {
    render(<CuisineSelector selected={[]} onChange={() => {}} />);
    const searchInput = screen.getByPlaceholderText('Search cuisines...');
    await userEvent.type(searchInput, 'Jap');
    expect(screen.getByText('Japanese')).toBeInTheDocument();
    // Should not show unrelated cuisines in search results
    expect(screen.queryByText('Italian')).not.toBeInTheDocument();
  });

  it('remove badge updates selection', async () => {
    const onChange = vi.fn();
    render(<CuisineSelector selected={['Italian', 'Thai']} onChange={onChange} />);
    const removeButton = screen.getByLabelText('Remove Italian');
    await userEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledWith(['Thai']);
  });

  it('shows "no results" when search matches nothing', async () => {
    render(<CuisineSelector selected={[]} onChange={() => {}} />);
    const searchInput = screen.getByPlaceholderText('Search cuisines...');
    await userEvent.type(searchInput, 'zzzzz');
    expect(screen.getByText(/No cuisines found/)).toBeInTheDocument();
  });

  it('toggles between Popular and All views', async () => {
    render(<CuisineSelector selected={[]} onChange={() => {}} />);
    // Initially shows "Most Popular"
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
    // Click "Show All"
    await userEvent.click(screen.getByText('Show All'));
    expect(screen.getByText('All Cuisines')).toBeInTheDocument();
    // Should now show all cuisines including less common ones
    expect(screen.getByText('Afghan')).toBeInTheDocument();
    expect(screen.getByText('Ethiopian')).toBeInTheDocument();
  });

  it('respects maxDisplay prop', () => {
    render(
      <CuisineSelector
        selected={['Italian', 'Mexican', 'Thai', 'Chinese', 'Japanese']}
        onChange={() => {}}
        maxDisplay={3}
      />
    );
    // Should show first 3 badges with remove buttons + "+2 more"
    expect(screen.getByLabelText('Remove Italian')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Mexican')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Thai')).toBeInTheDocument();
    // Chinese and Japanese badges should not have remove buttons (hidden)
    expect(screen.queryByLabelText('Remove Chinese')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove Japanese')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });
});
