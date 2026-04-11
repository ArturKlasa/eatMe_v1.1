/**
 * RestaurantMetadata
 *
 * Pure helper functions for restaurant display metadata:
 * current-day hours, payment notes, and hour formatting.
 * No React or side-effects — safe to unit-test in isolation.
 */

import { type RestaurantWithMenus } from '../../lib/supabase';

type OpenHours = Record<string, { open: string; close: string }> | null;

export function getCurrentDayHours(
  restaurant: RestaurantWithMenus
): { open: string; close: string } | null {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  const hours = restaurant.open_hours as OpenHours;
  return hours?.[today] || null;
}

export function getCurrentDayName(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

export type PaymentNote = { icon: string; label: string } | null;

export function getPaymentNote(
  paymentMethods: RestaurantWithMenus['payment_methods'] | null | undefined,
  t: (key: string) => string
): PaymentNote {
  switch (paymentMethods) {
    case 'cash_only':
      return { icon: '💵', label: t('restaurant.payment.cashOnly') };
    case 'card_only':
      return { icon: '💳', label: t('restaurant.payment.cardsOnly') };
    case 'cash_and_card':
      return { icon: '💵💳', label: t('restaurant.payment.cashAndCard') };
    default:
      return null;
  }
}
