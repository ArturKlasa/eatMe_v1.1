import { FormProgress } from '@/types/restaurant';

const STORAGE_KEY = 'restaurant_portal_data';
const AUTO_SAVE_DEBOUNCE = 500; // 500ms debounce

/**
 * Save restaurant form data to LocalStorage
 */
export const saveRestaurantData = (data: FormProgress): void => {
  try {
    const dataToSave = {
      ...data,
      lastSaved: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (error) {
    console.error('Failed to save data to LocalStorage:', error);
    throw new Error('Failed to save progress. Please try again.');
  }
};

/**
 * Load restaurant form data from LocalStorage
 */
export const loadRestaurantData = (): FormProgress | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return parsed;
  } catch (error) {
    console.error('Failed to load data from LocalStorage:', error);
    return null;
  }
};

/**
 * Clear all restaurant data from LocalStorage
 */
export const clearRestaurantData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear data from LocalStorage:', error);
  }
};

/**
 * Check if there's saved data in LocalStorage
 */
export const hasSavedData = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
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
