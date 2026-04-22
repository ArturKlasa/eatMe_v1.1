import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useReviewStore } from '../../store';
import { UndoToast } from '../UndoToast';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
  formatLocationForSupabase: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('UndoToast', () => {
  const mockClearLastSaved = vi.fn();
  const mockClearDraft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useReviewStore.setState({
      lastSavedAt: null,
      lastSavedJobId: '',
      lastSavedCount: 0,
      clearLastSaved: mockClearLastSaved,
      clearDraft: mockClearDraft,
      jobId: 'job-123',
    } as never);
  });

  it('renders nothing when lastSavedAt is null', () => {
    render(<UndoToast />);
    expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
  });

  it('renders the toast when lastSavedAt is set', () => {
    useReviewStore.setState({ lastSavedAt: new Date(), lastSavedCount: 5 } as never);
    render(<UndoToast />);
    expect(screen.getByTestId('undo-toast')).toBeInTheDocument();
  });

  it('shows the saved dish count', () => {
    useReviewStore.setState({ lastSavedAt: new Date(), lastSavedCount: 7 } as never);
    render(<UndoToast />);
    expect(screen.getByText(/Saved 7 dishes/)).toBeInTheDocument();
  });

  it('uses singular "dish" for count of 1', () => {
    useReviewStore.setState({ lastSavedAt: new Date(), lastSavedCount: 1 } as never);
    render(<UndoToast />);
    expect(screen.getByText(/Saved 1 dish\b/)).toBeInTheDocument();
  });

  it('clicking Undo calls the undo API with the job id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ undone: 5 }),
    });
    useReviewStore.setState({
      lastSavedAt: new Date(),
      lastSavedJobId: 'job-xyz',
      lastSavedCount: 5,
    } as never);
    render(<UndoToast />);
    fireEvent.click(screen.getByTestId('undo-button'));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/menu-scan/undo',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ job_id: 'job-xyz' }),
        })
      );
    });
  });

  it('calls clearLastSaved after successful undo', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ undone: 5 }),
    });
    useReviewStore.setState({
      lastSavedAt: new Date(),
      lastSavedJobId: 'job-xyz',
      lastSavedCount: 5,
    } as never);
    render(<UndoToast />);
    fireEvent.click(screen.getByTestId('undo-button'));
    await waitFor(() => expect(mockClearLastSaved).toHaveBeenCalled());
  });

  it('calls clearDraft after successful undo', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ undone: 5 }),
    });
    useReviewStore.setState({
      lastSavedAt: new Date(),
      lastSavedJobId: 'job-xyz',
      lastSavedCount: 5,
    } as never);
    render(<UndoToast />);
    fireEvent.click(screen.getByTestId('undo-button'));
    await waitFor(() => expect(mockClearDraft).toHaveBeenCalledWith('job-123'));
  });
});
