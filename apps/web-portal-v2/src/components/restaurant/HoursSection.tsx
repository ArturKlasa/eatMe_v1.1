'use client';

import { useState, useCallback } from 'react';
import { updateRestaurantHours } from '@/app/(app)/restaurant/[id]/actions/restaurant';
import type { RestaurantHoursInput } from '@eatme/shared';

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

type DayHours = { open: string; close: string };
type OperatingHours = Partial<Record<DayKey, DayHours>>;

interface RestaurantHoursSnapshot {
  open_hours?: OperatingHours | null;
  delivery_available?: boolean | null;
  takeout_available?: boolean | null;
  dine_in_available?: boolean | null;
  accepts_reservations?: boolean | null;
}

interface Props {
  restaurantId: string;
  initial?: RestaurantHoursSnapshot;
  onValidChange?: (valid: boolean) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function HoursSection({ restaurantId, initial, onValidChange }: Props) {
  const initHours = (initial?.open_hours ?? {}) as OperatingHours;

  const [openDays, setOpenDays] = useState<Record<DayKey, boolean>>(
    () => Object.fromEntries(DAYS.map(d => [d.key, d.key in initHours])) as Record<DayKey, boolean>
  );

  const [hours, setHours] = useState<OperatingHours>(
    () =>
      Object.fromEntries(
        DAYS.filter(d => d.key in initHours).map(d => [
          d.key,
          initHours[d.key] ?? { open: '09:00', close: '22:00' },
        ])
      ) as OperatingHours
  );

  const [delivery, setDelivery] = useState(initial?.delivery_available ?? false);
  const [takeout, setTakeout] = useState(initial?.takeout_available ?? false);
  const [dineIn, setDineIn] = useState(initial?.dine_in_available ?? false);
  const [reservations, setReservations] = useState(initial?.accepts_reservations ?? false);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  const buildPayload = useCallback(
    (
      currentOpenDays: Record<DayKey, boolean>,
      currentHours: OperatingHours,
      currentDelivery: boolean,
      currentTakeout: boolean,
      currentDineIn: boolean,
      currentReservations: boolean
    ): RestaurantHoursInput => {
      const operating_hours: OperatingHours = {};
      for (const { key } of DAYS) {
        if (currentOpenDays[key] && currentHours[key]) {
          operating_hours[key] = currentHours[key];
        }
      }
      return {
        operating_hours,
        delivery_available: currentDelivery,
        takeout_available: currentTakeout,
        dine_in_available: currentDineIn,
        accepts_reservations: currentReservations,
      };
    },
    []
  );

  const save = useCallback(
    async (
      currentOpenDays: Record<DayKey, boolean>,
      currentHours: OperatingHours,
      currentDelivery: boolean,
      currentTakeout: boolean,
      currentDineIn: boolean,
      currentReservations: boolean
    ) => {
      setSaveState('saving');
      setFormError(null);
      const payload = buildPayload(
        currentOpenDays,
        currentHours,
        currentDelivery,
        currentTakeout,
        currentDineIn,
        currentReservations
      );
      const result = await updateRestaurantHours(restaurantId, payload);
      if (!result.ok) {
        setSaveState('error');
        setFormError(result.formError ?? 'Save failed');
        onValidChange?.(false);
        return;
      }
      setSaveState('saved');
      onValidChange?.(true);
      setTimeout(() => setSaveState('idle'), 2000);
    },
    [restaurantId, buildPayload, onValidChange]
  );

  const toggleDay = (key: DayKey, checked: boolean) => {
    const newOpenDays = { ...openDays, [key]: checked };
    const newHours = { ...hours };
    if (checked && !newHours[key]) {
      newHours[key] = { open: '09:00', close: '22:00' };
    }
    setOpenDays(newOpenDays);
    setHours(newHours);
    save(newOpenDays, newHours, delivery, takeout, dineIn, reservations);
  };

  const updateDayHours = (key: DayKey, field: 'open' | 'close', value: string) => {
    const newHours = {
      ...hours,
      [key]: { ...(hours[key] ?? { open: '09:00', close: '22:00' }), [field]: value },
    };
    setHours(newHours);
  };

  const handleTimeBlur = () => {
    save(openDays, hours, delivery, takeout, dineIn, reservations);
  };

  const toggleService = (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    current: boolean,
    key: 'delivery' | 'takeout' | 'dineIn' | 'reservations'
  ) => {
    const newVal = !current;
    setter(newVal);
    const d = key === 'delivery' ? newVal : delivery;
    const t = key === 'takeout' ? newVal : takeout;
    const di = key === 'dineIn' ? newVal : dineIn;
    const r = key === 'reservations' ? newVal : reservations;
    save(openDays, hours, d, t, di, r);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Step 3: Hours & Services</h2>
        <div>
          {saveState === 'saving' && (
            <span className="text-sm text-muted-foreground">Saving...</span>
          )}
          {saveState === 'saved' && <span className="text-sm text-green-600">Hours saved.</span>}
          {saveState === 'error' && <span className="text-sm text-red-600">Failed to save.</span>}
        </div>
      </div>

      {formError && <p className="text-xs text-red-600">{formError}</p>}

      <div className="space-y-3">
        <p className="text-sm font-medium">Operating hours</p>
        {DAYS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <label className="flex items-center gap-2 w-32">
              <input
                type="checkbox"
                checked={openDays[key]}
                onChange={e => toggleDay(key, e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm">{label}</span>
            </label>
            {openDays[key] && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={hours[key]?.open ?? '09:00'}
                  onChange={e => updateDayHours(key, 'open', e.target.value)}
                  onBlur={handleTimeBlur}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <input
                  type="time"
                  value={hours[key]?.close ?? '22:00'}
                  onChange={e => updateDayHours(key, 'close', e.target.value)}
                  onBlur={handleTimeBlur}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
            {!openDays[key] && <span className="text-sm text-muted-foreground">Closed</span>}
          </div>
        ))}
      </div>

      <div className="space-y-3 pt-2 border-t border-border">
        <p className="text-sm font-medium">Services offered</p>
        {[
          {
            label: 'Delivery available',
            value: delivery,
            setter: setDelivery,
            key: 'delivery' as const,
          },
          {
            label: 'Takeout available',
            value: takeout,
            setter: setTakeout,
            key: 'takeout' as const,
          },
          { label: 'Dine-in available', value: dineIn, setter: setDineIn, key: 'dineIn' as const },
          {
            label: 'Accepts reservations',
            value: reservations,
            setter: setReservations,
            key: 'reservations' as const,
          },
        ].map(({ label, value, setter, key }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value}
              onChange={() => toggleService(setter, value, key)}
              className="rounded border-input"
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
