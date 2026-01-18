import { FormProgress } from '@/types/restaurant';

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
 * Debounced auto-save function
 */
let saveTimeout: NodeJS.Timeout | null = null;

export const autoSave = (data: FormProgress): void => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveRestaurantData(data);
  }, AUTO_SAVE_DEBOUNCE);
};
