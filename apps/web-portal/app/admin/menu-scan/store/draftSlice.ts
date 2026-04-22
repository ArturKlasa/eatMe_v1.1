import { StateCreator } from 'zustand';
import { toast } from 'sonner';

// Module-level variables — not Zustand state
let _draftTimer: ReturnType<typeof setTimeout> | null = null;
let _draftUnsub: (() => void) | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DraftSubscribeFn = (listener: (state: any) => void) => () => void;

export interface DraftSlice {
  loadDraft: (jobId: string) => boolean;
  clearDraft: (jobId: string) => void;
  initDraftSync: (jobId: string, subscribeFn: DraftSubscribeFn) => void;
  cleanupDraftSync: () => void;
}

const DRAFT_VERSION = 2;

function draftKey(jobId: string): string {
  return `menu-scan-draft:${jobId}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createDraftSlice: StateCreator<any, [], [], DraftSlice> = (set, _get) => ({
  loadDraft: (jobId: string): boolean => {
    try {
      const raw = localStorage.getItem(draftKey(jobId));
      if (!raw) return false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = JSON.parse(raw);

      if (parsed.version !== DRAFT_VERSION) {
        toast.warning('Draft incompatible with this version — starting fresh');
        localStorage.removeItem(draftKey(jobId));
        return false;
      }

      set({ editableMenus: parsed.editableMenus });
      toast.success('Draft restored');
      return true;
    } catch {
      return false;
    }
  },

  clearDraft: (jobId: string): void => {
    localStorage.removeItem(draftKey(jobId));
  },

  initDraftSync: (jobId: string, subscribeFn: DraftSubscribeFn): void => {
    // Clean up any existing subscription first
    if (_draftUnsub) {
      _draftUnsub();
      _draftUnsub = null;
    }
    if (_draftTimer !== null) {
      clearTimeout(_draftTimer);
      _draftTimer = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsub = subscribeFn((state: any) => {
      if (_draftTimer !== null) {
        clearTimeout(_draftTimer);
      }
      _draftTimer = setTimeout(() => {
        try {
          localStorage.setItem(
            draftKey(jobId),
            JSON.stringify({
              version: DRAFT_VERSION,
              editableMenus: state.editableMenus,
              timestamp: Date.now(),
            })
          );
        } catch {
          // localStorage may be full or unavailable — silently ignore
        }
        _draftTimer = null;
      }, 500);
    });

    _draftUnsub = unsub;
  },

  cleanupDraftSync: (): void => {
    if (_draftTimer !== null) {
      clearTimeout(_draftTimer);
      _draftTimer = null;
    }
    if (_draftUnsub) {
      _draftUnsub();
      _draftUnsub = null;
    }
  },
});
