import type { FormProgress } from '@eatme/shared';

// User-scoped storage key to isolate data per user
const getStorageKey = (userId: string) => `eatme_draft_${userId}`;
const AUTO_SAVE_DEBOUNCE = 500; // 500ms debounce

interface DraftData extends FormProgress {
  lastSaved: string;
}

export const saveRestaurantData = (userId: string, data: FormProgress): void => {
  try {
    const dataToSave: DraftData = {
      ...data,
      lastSaved: new Date().toISOString(),
    };
    localStorage.setItem(getStorageKey(userId), JSON.stringify(dataToSave));
  } catch (error) {
    console.error('Failed to save data to LocalStorage:', error);
    throw new Error('Failed to save progress. Please try again.');
  }
};

export const loadRestaurantData = (userId: string): FormProgress | null => {
  try {
    const data = localStorage.getItem(getStorageKey(userId));
    if (!data) return null;

    const parsed = JSON.parse(data);
    return parsed;
  } catch (error) {
    console.error('Failed to load data from LocalStorage:', error);
    return null;
  }
};

export const clearRestaurantData = (userId: string): void => {
  try {
    localStorage.removeItem(getStorageKey(userId));
  } catch (error) {
    console.error('Failed to clear data from LocalStorage:', error);
  }
};

// Called on login to clean up stale drafts from abandoned onboarding sessions.
export const clearIfStale = (userId: string, maxAgeDays = 7): boolean => {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return false;

    const parsed = JSON.parse(raw) as DraftData;
    if (!parsed.lastSaved) return false;

    const ageMs = Date.now() - new Date(parsed.lastSaved).getTime();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    if (ageMs > maxAgeMs) {
      localStorage.removeItem(getStorageKey(userId));
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Storage] Failed to check draft staleness:', error);
    return false;
  }
};

// Call cancelAutoSave() in effect cleanup to avoid writes after unmount.
let saveTimeout: NodeJS.Timeout | null = null;

export const autoSave = (userId: string, data: FormProgress): void => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveRestaurantData(userId, data);
    saveTimeout = null;
  }, AUTO_SAVE_DEBOUNCE);
};

export const cancelAutoSave = (): void => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
};
