import { StateCreator } from 'zustand';

export interface SavedMetaSlice {
  lastSavedAt: Date | null;
  lastSavedJobId: string;
  lastSavedCount: number;
  setLastSaved: (jobId: string, count: number) => void;
  clearLastSaved: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createSavedMetaSlice: StateCreator<any, [], [], SavedMetaSlice> = set => ({
  lastSavedAt: null,
  lastSavedJobId: '',
  lastSavedCount: 0,

  setLastSaved: (jobId, count) =>
    set({ lastSavedAt: new Date(), lastSavedJobId: jobId, lastSavedCount: count }),

  clearLastSaved: () => set({ lastSavedAt: null, lastSavedJobId: '', lastSavedCount: 0 }),
});
