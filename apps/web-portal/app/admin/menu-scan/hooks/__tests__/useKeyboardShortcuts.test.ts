import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, fireEvent } from '@testing-library/react';
import { useReviewStore } from '../../store';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { newEmptyDish } from '@/lib/menu-scan';
import type { EditableMenu } from '@/lib/menu-scan';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
  formatLocationForSupabase: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/lib/menu-scan-utils', () => ({
  pdfToImages: vi.fn().mockResolvedValue([]),
  resizeImageToBase64: vi.fn().mockResolvedValue('data:image/jpeg;base64,test'),
}));

vi.mock('@/lib/menuScanConfig', () => ({ CONFIDENCE_THRESHOLD: 0.7 }));

vi.stubGlobal(
  'requestAnimationFrame',
  vi.fn((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  })
);

function makeMenu(dishes: ReturnType<typeof newEmptyDish>[]): EditableMenu[] {
  return [{ name: 'Menu', menu_type: 'food', categories: [{ name: 'Cat', dishes }] }];
}

describe('useKeyboardShortcuts', () => {
  const mockOnOpenSaveModal = vi.fn();
  const mockAcceptGroup = vi.fn();
  const mockRejectGroup = vi.fn();
  const mockSetExpandedDishes = vi.fn();
  const mockSetFocusedGroupId = vi.fn();
  const mockSetLightboxOpen = vi.fn();

  const dish1 = { ...newEmptyDish(), _id: 'dish-1', confidence: 0.9 };
  const dish2 = { ...newEmptyDish(), _id: 'dish-2', confidence: 0.9 };

  beforeEach(() => {
    vi.clearAllMocks();
    useReviewStore.setState({
      editableMenus: makeMenu([dish1, dish2]),
      expandedDishes: new Set<string>(),
      focusedGroupId: null,
      lightboxOpen: false,
      acceptGroup: mockAcceptGroup,
      rejectGroup: mockRejectGroup,
      setExpandedDishes: mockSetExpandedDishes,
      setFocusedGroupId: mockSetFocusedGroupId,
      setLightboxOpen: mockSetLightboxOpen,
    } as never);
  });

  afterEach(() => {
    // Remove any stray input elements added during tests
    document.querySelectorAll('input[data-test]').forEach(el => el.remove());
  });

  // -------------------------------------------------------------------------
  // E key
  // -------------------------------------------------------------------------

  it('E key outside input calls setExpandedDishes (expand all)', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'e' });
    expect(mockSetExpandedDishes).toHaveBeenCalledTimes(1);
  });

  it('E key with uppercase K calls setExpandedDishes', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'E' });
    expect(mockSetExpandedDishes).toHaveBeenCalledTimes(1);
  });

  it('E key expands all dishes when none are expanded', () => {
    useReviewStore.setState({ expandedDishes: new Set<string>() } as never);
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'e' });
    const arg = mockSetExpandedDishes.mock.calls[0][0] as Set<string>;
    expect(arg).toBeInstanceOf(Set);
    expect(arg.has('dish-1')).toBe(true);
    expect(arg.has('dish-2')).toBe(true);
  });

  it('E key collapses all dishes when some are expanded', () => {
    useReviewStore.setState({ expandedDishes: new Set(['dish-1']) } as never);
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'e' });
    const arg = mockSetExpandedDishes.mock.calls[0][0] as Set<string>;
    expect(arg).toBeInstanceOf(Set);
    expect(arg.size).toBe(0);
  });

  it('E key inside INPUT does not call setExpandedDishes', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    const input = document.createElement('input');
    input.setAttribute('data-test', 'true');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'e' });
    expect(mockSetExpandedDishes).not.toHaveBeenCalled();
    input.remove();
  });

  it('E key inside TEXTAREA does not call setExpandedDishes', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    fireEvent.keyDown(textarea, { key: 'e' });
    expect(mockSetExpandedDishes).not.toHaveBeenCalled();
    textarea.remove();
  });

  // -------------------------------------------------------------------------
  // N key
  // -------------------------------------------------------------------------

  it('N key calls setExpandedDishes for a flagged dish', () => {
    const flaggedDish = {
      ...newEmptyDish(),
      _id: 'flagged-1',
      confidence: 0.5,
      group_status: 'ai_proposed' as const,
    };
    useReviewStore.setState({ editableMenus: makeMenu([flaggedDish]) } as never);
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'n' });
    expect(mockSetExpandedDishes).toHaveBeenCalledTimes(1);
  });

  it('N key does nothing when no flagged dishes exist', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'n' });
    expect(mockSetExpandedDishes).not.toHaveBeenCalled();
  });

  it('N key inside INPUT does not navigate', () => {
    const flaggedDish = {
      ...newEmptyDish(),
      _id: 'flagged-1',
      confidence: 0.5,
      group_status: 'ai_proposed' as const,
    };
    useReviewStore.setState({ editableMenus: makeMenu([flaggedDish]) } as never);
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'n' });
    expect(mockSetExpandedDishes).not.toHaveBeenCalled();
    input.remove();
  });

  // -------------------------------------------------------------------------
  // Cmd/Ctrl+S
  // -------------------------------------------------------------------------

  it('Ctrl+S calls onOpenSaveModal', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 's', ctrlKey: true });
    expect(mockOnOpenSaveModal).toHaveBeenCalledTimes(1);
  });

  it('Meta+S calls onOpenSaveModal', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 's', metaKey: true });
    expect(mockOnOpenSaveModal).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+S inside INPUT still calls onOpenSaveModal', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 's', ctrlKey: true });
    expect(mockOnOpenSaveModal).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it('plain S key does not call onOpenSaveModal', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 's' });
    expect(mockOnOpenSaveModal).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // A key
  // -------------------------------------------------------------------------

  it('A calls acceptGroup when focusedGroupId is set', () => {
    useReviewStore.setState({ focusedGroupId: 'group-1' } as never);
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'a' });
    expect(mockAcceptGroup).toHaveBeenCalledWith('group-1');
  });

  it('A does not call acceptGroup when focusedGroupId is null', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'a' });
    expect(mockAcceptGroup).not.toHaveBeenCalled();
  });

  it('A inside INPUT does not call acceptGroup', () => {
    useReviewStore.setState({ focusedGroupId: 'group-1' } as never);
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'a' });
    expect(mockAcceptGroup).not.toHaveBeenCalled();
    input.remove();
  });

  // -------------------------------------------------------------------------
  // R key
  // -------------------------------------------------------------------------

  it('R calls rejectGroup when focusedGroupId is set', () => {
    useReviewStore.setState({ focusedGroupId: 'group-1' } as never);
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'r' });
    expect(mockRejectGroup).toHaveBeenCalledWith('group-1');
  });

  it('R does not call rejectGroup when focusedGroupId is null', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'r' });
    expect(mockRejectGroup).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Escape key
  // -------------------------------------------------------------------------

  it('Escape closes lightbox when lightbox is open', () => {
    useReviewStore.setState({ lightboxOpen: true } as never);
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockSetLightboxOpen).toHaveBeenCalledWith(false);
    expect(mockSetFocusedGroupId).not.toHaveBeenCalled();
  });

  it('Escape clears focusedGroupId when lightbox is closed', () => {
    useReviewStore.setState({ focusedGroupId: 'group-1', lightboxOpen: false } as never);
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockSetFocusedGroupId).toHaveBeenCalledWith(null);
    expect(mockSetLightboxOpen).not.toHaveBeenCalled();
  });

  it('Escape does nothing when lightbox closed and no focused group', () => {
    renderHook(() => useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockSetLightboxOpen).not.toHaveBeenCalled();
    expect(mockSetFocusedGroupId).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it('removes keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ onOpenSaveModal: mockOnOpenSaveModal })
    );
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});
