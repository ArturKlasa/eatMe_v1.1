'use client';

/**
 * useRestaurantDraft Hook
 *
 * Manages the onboarding wizard's draft state — loading from LocalStorage on
 * mount, auto-saving on changes, and computing derived UI state (completion
 * percentages, form defaults). Keeps page components free of storage concerns.
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { type UseFormWatch } from 'react-hook-form';
import { loadRestaurantData, autoSave, cancelAutoSave } from '@/lib/storage';
import type {
  RestaurantBasicInfo,
  RestaurantOperations,
  FormProgress,
  RestaurantType,
  PaymentMethods,
} from '@eatme/shared';
import { DAYS_OF_WEEK } from '@eatme/shared';
import type { BasicInfoFormData } from '@/components/onboarding/types';

const DEFAULT_HOURS: Record<string, { open: string; close: string; closed: boolean }> = {
  monday: { open: '09:00', close: '21:00', closed: false },
  tuesday: { open: '09:00', close: '21:00', closed: false },
  wednesday: { open: '09:00', close: '21:00', closed: false },
  thursday: { open: '09:00', close: '21:00', closed: false },
  friday: { open: '09:00', close: '22:00', closed: false },
  saturday: { open: '09:00', close: '22:00', closed: false },
  sunday: { open: '10:00', close: '20:00', closed: false },
};

export interface DraftData {
  mapCoordinates: { lat: number; lng: number } | null;
  selectedCuisines: string[];
  restaurantType: string;
  country: string;
  serviceSpeed: 'fast-food' | 'regular';
  paymentMethods: PaymentMethods;
  operatingHours: Record<string, { open: string; close: string; closed: boolean }>;
}

/**
 * Loads the current draft from localStorage and maps it onto {@link DraftData}.
 * Returns sensible defaults when called on the server (SSR) or with no userId.
 *
 * @param userId - The authenticated user's ID used as the storage key.
 * @returns Merged draft state for pre-populating the basic-info form.
 */
function loadDraftData(userId: string | undefined): DraftData {
  if (typeof window === 'undefined' || !userId) {
    return {
      mapCoordinates: null,
      selectedCuisines: [],
      restaurantType: 'restaurant',
      country: 'US',
      serviceSpeed: 'regular',
      paymentMethods: 'cash_and_card',
      operatingHours: { ...DEFAULT_HOURS },
    };
  }

  const savedData = loadRestaurantData(userId);

  let mapCoordinates: { lat: number; lng: number } | null = null;
  if (savedData?.basicInfo?.location?.lat && savedData?.basicInfo?.location?.lng) {
    mapCoordinates = {
      lat: savedData.basicInfo.location.lat,
      lng: savedData.basicInfo.location.lng,
    };
  }

  let operatingHours = { ...DEFAULT_HOURS };
  if (savedData?.operations?.operating_hours) {
    const hours: Record<string, { open: string; close: string; closed: boolean }> = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      const dayHours =
        savedData.operations.operating_hours?.[
          key as keyof typeof savedData.operations.operating_hours
        ];
      if (dayHours) {
        hours[key] = { ...dayHours, closed: false };
      } else {
        hours[key] = { open: '09:00', close: '21:00', closed: true };
      }
    });
    operatingHours = hours;
  }

  return {
    mapCoordinates,
    selectedCuisines: savedData?.basicInfo?.cuisines || [],
    restaurantType: savedData?.basicInfo?.restaurant_type || 'restaurant',
    country: savedData?.basicInfo?.country || 'US',
    serviceSpeed: savedData?.operations?.service_speed || 'regular',
    paymentMethods: (savedData?.operations?.payment_methods as PaymentMethods) || 'cash_and_card',
    operatingHours,
  };
}

/** Options for {@link useRestaurantDraft}. */
interface UseRestaurantDraftOptions {
  /** Authenticated user ID used to scope the localStorage key. */
  userId: string | undefined;
  /** react-hook-form `watch` — subscribes to field changes to trigger auto-save. */
  watch: UseFormWatch<BasicInfoFormData>;
  /** Ref holding the current selected cuisines array (not a form field). */
  selectedCuisinesRef: React.RefObject<string[]>;
  /** Ref holding the current operating-hours state (not a react-hook-form field). */
  operatingHoursRef: React.RefObject<Record<string, { open: string; close: string; closed: boolean }>>;
}

interface UseRestaurantDraftReturn {
  draftData: DraftData;
  lastSaved: Date | null;
  saving: boolean;
}

/**
 * Subscribes to react-hook-form `watch` and auto-saves draft progress to
 * localStorage on every change (debounced to 500 ms via {@link autoSave}).
 *
 * The `saving` flag is set immediately on change and cleared ~600 ms later
 * (slightly after the debounce settles) so the UI can show a "Saving…" indicator
 * without flickering on every keystroke.
 *
 * @param options - See {@link UseRestaurantDraftOptions}.
 * @returns `draftData` for form defaults, `lastSaved` timestamp, and `saving` flag.
 */
export function useRestaurantDraft({
  userId,
  watch,
  selectedCuisinesRef,
  operatingHoursRef,
}: UseRestaurantDraftOptions): UseRestaurantDraftReturn {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft data once on mount — useMemo ensures stable reference
  const draftData = useMemo(() => loadDraftData(userId), [userId]);

  useEffect(() => {
    const subscription = watch(currentValues => {
      if (!userId) return;

      setSaving(true);

      const savedData = loadRestaurantData(userId);
      const loc = currentValues.location;
      const basicInfo: Partial<RestaurantBasicInfo> = {
        name: currentValues.name,
        restaurant_type: currentValues.restaurant_type as RestaurantType,
        description: currentValues.description || undefined,
        country: loc?.country,
        city: loc?.city || undefined,
        neighbourhood: loc?.neighborhood || undefined,
        state: loc?.state || undefined,
        postal_code: loc?.postalCode || undefined,
        address: loc?.address,
        location: {
          lat: loc?.lat || 0,
          lng: loc?.lng || 0,
        },
        phone: currentValues.phone || undefined,
        website: currentValues.website || undefined,
        cuisines: selectedCuisinesRef.current,
      };

      const operating_hours: Record<string, { open: string; close: string }> = {};
      Object.entries(operatingHoursRef.current).forEach(([day, hours]) => {
        if (!hours.closed) {
          operating_hours[day] = { open: hours.open, close: hours.close };
        }
      });

      const operations: Partial<RestaurantOperations> = {
        operating_hours,
        delivery_available: currentValues.delivery_available,
        takeout_available: currentValues.takeout_available,
        dine_in_available: currentValues.dine_in_available,
        service_speed: currentValues.service_speed,
        accepts_reservations: currentValues.accepts_reservations,
        payment_methods: currentValues.payment_methods as PaymentMethods | undefined,
      };

      const updatedData: FormProgress = {
        basicInfo,
        operations,
        menus: savedData?.menus || [],
        dishes: savedData?.dishes || [],
        currentStep: savedData?.currentStep ?? 1,
      };

      autoSave(userId, updatedData);

      // Show saving indicator, then mark as saved after debounce settles
      if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
      savingTimeoutRef.current = setTimeout(() => {
        setSaving(false);
        setLastSaved(new Date());
      }, 600); // slightly longer than autoSave debounce (500ms)
    });

    return () => {
      subscription.unsubscribe();
      cancelAutoSave();
      if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    };
  }, [watch, userId, selectedCuisinesRef, operatingHoursRef]);

  return { draftData, lastSaved, saving };
}

/**
 * Load initial form defaults from localStorage for the given user.
 */
export function loadFormDefaults(userId: string | undefined): BasicInfoFormData {
  const defaults: BasicInfoFormData = {
    name: '',
    restaurant_type: 'restaurant',
    description: '',
    location: {
      country: 'US',
      address: '',
      city: '',
      neighborhood: '',
      state: '',
      postalCode: '',
      lat: 0,
      lng: 0,
    },
    phone: '',
    website: '',
    delivery_available: true,
    takeout_available: true,
    dine_in_available: true,
    service_speed: 'regular',
    accepts_reservations: false,
    payment_methods: 'cash_and_card',
  };

  if (typeof window === 'undefined' || !userId) return defaults;

  const savedData = loadRestaurantData(userId);
  if (!savedData) return defaults;

  return {
    name: savedData.basicInfo?.name || '',
    restaurant_type: savedData.basicInfo?.restaurant_type || 'restaurant',
    description: savedData.basicInfo?.description || '',
    location: {
      country: savedData.basicInfo?.country || 'US',
      address: savedData.basicInfo?.address || '',
      city: savedData.basicInfo?.city || '',
      neighborhood: savedData.basicInfo?.neighbourhood || '',
      state: savedData.basicInfo?.state || '',
      postalCode: savedData.basicInfo?.postal_code || '',
      lat: savedData.basicInfo?.location?.lat || 0,
      lng: savedData.basicInfo?.location?.lng || 0,
    },
    phone: savedData.basicInfo?.phone || '',
    website: savedData.basicInfo?.website || '',
    delivery_available: savedData.operations?.delivery_available ?? true,
    takeout_available: savedData.operations?.takeout_available ?? true,
    dine_in_available: savedData.operations?.dine_in_available ?? true,
    service_speed: savedData.operations?.service_speed || 'regular',
    accepts_reservations: savedData.operations?.accepts_reservations ?? false,
    payment_methods: (savedData.operations?.payment_methods as PaymentMethods) ?? 'cash_and_card',
  };
}
