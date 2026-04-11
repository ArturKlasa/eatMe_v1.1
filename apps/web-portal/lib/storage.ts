/**
 * Restaurant Draft Storage
 *
 * LocalStorage persistence layer for the restaurant onboarding wizard.
 * Drafts are keyed per-user so multi-account browsers don't share state.
 * Auto-save uses a 500 ms debounce to avoid thrashing storage on rapid field edits.
 */

import type { FormProgress } from '@eatme/shared';

// User-scoped storage key to isolate data per user
const getStorageKey = (userId: string) => `eatme_draft_${userId}`;
const AUTO_SAVE_DEBOUNCE = 500; // 500ms debounce

/**
 * Save restaurant form data to LocalStorage (user-scoped)
 */
export const saveRestaurantData = (userId: string, data: FormProgress): void => {
  try {
    const dataToSave = {
      ...data,
      lastSaved: new Date().toISOString(),
    };
    localStorage.setItem(getStorageKey(userId), JSON.stringify(dataToSave));
  } catch (error) {
    console.error('Failed to save data to LocalStorage:', error);
    throw new Error('Failed to save progress. Please try again.');
  }
};

/**
 * Load restaurant form data from LocalStorage (user-scoped)
 */
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

/**
 * Clear restaurant data from LocalStorage for specific user
 */
export const clearRestaurantData = (userId: string): void => {
  try {
    localStorage.removeItem(getStorageKey(userId));
  } catch (error) {
    console.error('Failed to clear data from LocalStorage:', error);
  }
};

/**
 * Check if there's saved data in LocalStorage for specific user
 */
export const hasSavedData = (userId: string): boolean => {
  try {
    return localStorage.getItem(getStorageKey(userId)) !== null;
  } catch (error) {
    console.error('Failed to check for saved data:', error);
    return false;
  }
};

/**
 * Clear the draft for a user if it is older than `maxAgeDays` days.
 *
 * Called on login so stale drafts from abandoned onboarding sessions are
 * cleaned up automatically. Uses the `lastSaved` timestamp that
 * `saveRestaurantData` writes on every save.
 *
 * @returns true if the draft was cleared, false if it was kept or absent.
 */
export const clearIfStale = (userId: string, maxAgeDays = 7): boolean => {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return false;

    const parsed = JSON.parse(raw) as FormProgress;
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

/**
 * Debounced auto-save function.
 * Use this inside watch() subscriptions or other high-frequency change handlers.
 * Call cancelAutoSave() in the effect cleanup to avoid writes after unmount.
 */
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

/**
 * Cancel any pending debounced auto-save.
 * Call this in the cleanup of the effect that calls autoSave.
 */
export const cancelAutoSave = (): void => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
};
