/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createDraftSlice, DraftSlice } from '../draftSlice';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore() {
  return createStore<DraftSlice>()(createDraftSlice);
}

const JOB_ID = 'test-job-123';
const DRAFT_KEY = `menu-scan-draft:${JOB_ID}`;
const SAMPLE_MENUS = [{ name: 'Menu', menu_type: 'food', categories: [] }];

// ---------------------------------------------------------------------------
// loadDraft
// ---------------------------------------------------------------------------

describe('draftSlice — loadDraft', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns false and no toast when no item in localStorage', () => {
    const store = makeStore();
    const result = store.getState().loadDraft(JOB_ID);
    expect(result).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('returns true, sets editableMenus, and shows success toast for version 2 draft', () => {
    localStorageMock.setItem(
      DRAFT_KEY,
      JSON.stringify({ version: 2, editableMenus: SAMPLE_MENUS, timestamp: Date.now() })
    );
    const store = makeStore();
    const result = store.getState().loadDraft(JOB_ID);
    expect(result).toBe(true);
    expect((store.getState() as any).editableMenus).toEqual(SAMPLE_MENUS);
    expect(toast.success).toHaveBeenCalledWith('Draft restored');
  });

  it('returns false and shows warning toast for version mismatch (version=1)', () => {
    localStorageMock.setItem(
      DRAFT_KEY,
      JSON.stringify({ version: 1, editableMenus: SAMPLE_MENUS, timestamp: Date.now() })
    );
    const store = makeStore();
    const result = store.getState().loadDraft(JOB_ID);
    expect(result).toBe(false);
    expect(toast.warning).toHaveBeenCalledWith(
      'Draft incompatible with this version — starting fresh'
    );
    // Key should be removed
    expect(localStorageMock.getItem(DRAFT_KEY)).toBeNull();
  });

  it('returns false without crashing on corrupted JSON', () => {
    localStorageMock.setItem(DRAFT_KEY, 'not-valid-json{{{');
    const store = makeStore();
    expect(() => store.getState().loadDraft(JOB_ID)).not.toThrow();
    const result = store.getState().loadDraft(JOB_ID);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clearDraft
// ---------------------------------------------------------------------------

describe('draftSlice — clearDraft', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('removes the draft key from localStorage', () => {
    localStorageMock.setItem(
      DRAFT_KEY,
      JSON.stringify({ version: 2, editableMenus: [], timestamp: Date.now() })
    );
    const store = makeStore();
    store.getState().clearDraft(JOB_ID);
    expect(localStorageMock.getItem(DRAFT_KEY)).toBeNull();
  });

  it('does not throw when key does not exist', () => {
    const store = makeStore();
    expect(() => store.getState().clearDraft(JOB_ID)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// initDraftSync / cleanupDraftSync
// ---------------------------------------------------------------------------

describe('draftSlice — initDraftSync', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes draft to localStorage after 500ms debounce', () => {
    const store = makeStore();

    let capturedListener: ((state: any) => void) | null = null;
    const mockSubscribeFn = (listener: (state: any) => void) => {
      capturedListener = listener;
      return () => {
        capturedListener = null;
      };
    };

    store.getState().initDraftSync(JOB_ID, mockSubscribeFn);
    expect(capturedListener).not.toBeNull();

    // Trigger state change
    capturedListener!({ editableMenus: SAMPLE_MENUS });

    // Before 500ms — not written yet
    vi.advanceTimersByTime(400);
    expect(localStorageMock.getItem(DRAFT_KEY)).toBeNull();

    // After 500ms — written
    vi.advanceTimersByTime(100);
    const saved = localStorageMock.getItem(DRAFT_KEY);
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.version).toBe(2);
    expect(parsed.editableMenus).toEqual(SAMPLE_MENUS);
    expect(parsed.timestamp).toBeTypeOf('number');
  });

  it('debounces: only writes once when state changes multiple times within 500ms', () => {
    const store = makeStore();

    let capturedListener: ((state: any) => void) | null = null;
    const mockSubscribeFn = (listener: (state: any) => void) => {
      capturedListener = listener;
      return () => {
        capturedListener = null;
      };
    };

    store.getState().initDraftSync(JOB_ID, mockSubscribeFn);

    capturedListener!({ editableMenus: [{ name: 'First' }] });
    vi.advanceTimersByTime(300);
    capturedListener!({ editableMenus: SAMPLE_MENUS });
    vi.advanceTimersByTime(300);

    // Only 300ms since last change — not written yet
    expect(localStorageMock.getItem(DRAFT_KEY)).toBeNull();

    vi.advanceTimersByTime(200);

    // Now written with the last state
    const saved = localStorageMock.getItem(DRAFT_KEY);
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.editableMenus).toEqual(SAMPLE_MENUS);
  });
});

describe('draftSlice — cleanupDraftSync', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears timer and calls unsub', () => {
    const store = makeStore();
    const unsubSpy = vi.fn();

    let capturedListener: ((state: any) => void) | null = null;
    const mockSubscribeFn = (listener: (state: any) => void) => {
      capturedListener = listener;
      return unsubSpy;
    };

    store.getState().initDraftSync(JOB_ID, mockSubscribeFn);

    // Trigger a pending timer
    capturedListener!({ editableMenus: SAMPLE_MENUS });
    vi.advanceTimersByTime(200); // timer pending

    store.getState().cleanupDraftSync();

    // Timer should be cancelled — nothing written
    vi.advanceTimersByTime(500);
    expect(localStorageMock.getItem(DRAFT_KEY)).toBeNull();

    // Unsub should have been called
    expect(unsubSpy).toHaveBeenCalled();
  });
});
