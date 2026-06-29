/**
 * Internationalization Utilities
 *
 * Utility functions for formatting currencies, dates, times, and handling regional preferences.
 */

import { getCurrentLanguage, getSupportedLanguages } from '../i18n';
import { formatPrice, type SupportedCurrency } from './currencyConfig';
import { useSettingsStore } from '../stores/settingsStore';

// Currency formatting
// Delegates to currencyConfig.formatPrice which uses the correct locale per currency.
export const formatCurrency = (amount: number, currencyCode?: string): string => {
  // Prefer explicitly passed code, then settingsStore currency, then language fallback.
  const storeCurrency = (() => {
    try {
      return useSettingsStore.getState().currency as SupportedCurrency;
    } catch {
      return undefined;
    }
  })();

  const supportedLanguages = getSupportedLanguages();
  const currentLanguage = getCurrentLanguage();
  const langCurrency = (
    supportedLanguages.find(lang => lang.code === currentLanguage) as
      | { code: string; name: string; flag: string; currency?: string }
      | undefined
  )?.currency;

  const currency = (currencyCode ?? storeCurrency ?? langCurrency ?? 'USD') as SupportedCurrency;
  return formatPrice(amount, currency);
};

// Time formatting based on region
export const formatTime = (date: Date, options?: { use24Hour?: boolean }): string => {
  const currentLanguage = getCurrentLanguage();

  // Use 12-hour format for USA, 24-hour for others
  const use24Hour = options?.use24Hour !== undefined ? options.use24Hour : currentLanguage !== 'en';

  try {
    return new Intl.DateTimeFormat(
      currentLanguage === 'en' ? 'en-US' : currentLanguage === 'es' ? 'es-MX' : 'pl-PL',
      {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !use24Hour,
      }
    ).format(date);
  } catch (error) {
    // Fallback to basic formatting
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (use24Hour) {
      return `${hours}:${minutes}`;
    } else {
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${period}`;
    }
  }
};

/**
 * Determine whether a restaurant is currently open.
 *
 * @param openHours - Keyed by lowercase day name (e.g. "monday"). Absent days are treated
 *   as closed. Values are { open: "HH:MM", close: "HH:MM" } in the restaurant's local time.
 *   The device's local clock is used as a reasonable approximation for nearby restaurants.
 * @returns true if the current device time falls within today's opening window.
 */
export const isRestaurantOpenNow = (
  openHours: Record<string, { open: string; close: string }> | null | undefined
): boolean => {
  if (!openHours) return false;

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  const todayEntry = openHours[today];

  if (!todayEntry) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = todayEntry.open.split(':').map(Number);
  const [closeH, closeM] = todayEntry.close.split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Handle overnight hours (e.g. open: "22:00", close: "02:00")
  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
};

// Opening hours formatting
export const formatOpeningHours = (openTime: string, closeTime: string): string => {
  const currentLanguage = getCurrentLanguage();

  try {
    // Parse times (assuming HH:MM format)
    const [openHour, openMinute] = openTime.split(':').map(Number);
    const [closeHour, closeMinute] = closeTime.split(':').map(Number);

    const openDate = new Date();
    openDate.setHours(openHour, openMinute, 0, 0);

    const closeDate = new Date();
    closeDate.setHours(closeHour, closeMinute, 0, 0);

    const formattedOpen = formatTime(openDate, { use24Hour: currentLanguage !== 'en' });
    const formattedClose = formatTime(closeDate, { use24Hour: currentLanguage !== 'en' });

    return `${formattedOpen} - ${formattedClose}`;
  } catch (error) {
    // Fallback to original format
    return `${openTime} - ${closeTime}`;
  }
};
