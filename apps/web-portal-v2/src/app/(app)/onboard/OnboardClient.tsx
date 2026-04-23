'use client';

import { useState } from 'react';
import { OnboardingStepper } from '@eatme/ui';
import {
  BasicInfoSection,
  type RestaurantSnapshot,
} from '@/components/restaurant/BasicInfoSection';
import { LocationSection } from '@/components/restaurant/LocationSection';
import { HoursSection } from '@/components/restaurant/HoursSection';
import { CuisinesSection } from '@/components/restaurant/CuisinesSection';
import { PhotosSection } from '@/components/restaurant/PhotosSection';

const STEPS = [
  { label: 'Basics' },
  { label: 'Location' },
  { label: 'Hours' },
  { label: 'Cuisines' },
  { label: 'Photos' },
];

interface RestaurantData extends RestaurantSnapshot {
  location?: unknown;
  open_hours?: unknown;
  delivery_available?: boolean | null;
  takeout_available?: boolean | null;
  dine_in_available?: boolean | null;
  accepts_reservations?: boolean | null;
  image_url?: string | null;
}

interface Props {
  restaurant: RestaurantData;
  initialStep?: number;
}

export function OnboardClient({ restaurant, initialStep = 0 }: Props) {
  const [stepValidity, setStepValidity] = useState<Array<boolean | undefined>>(
    Array(STEPS.length).fill(undefined)
  );

  function setValid(step: number, valid: boolean) {
    setStepValidity(prev => {
      const next = [...prev];
      next[step] = valid;
      return next;
    });
  }

  // Parse location for pre-filling LocationSection
  let initialLat: number | undefined;
  let initialLng: number | undefined;
  if (
    restaurant.location &&
    typeof restaurant.location === 'object' &&
    'coordinates' in (restaurant.location as object)
  ) {
    const loc = restaurant.location as { coordinates: [number, number] };
    initialLng = loc.coordinates[0];
    initialLat = loc.coordinates[1];
    // Ignore default POINT(0 0)
    if (initialLat === 0 && initialLng === 0) {
      initialLat = undefined;
      initialLng = undefined;
    }
  }

  return (
    <OnboardingStepper
      steps={STEPS}
      initialStep={initialStep}
      stepValidity={stepValidity}
      onStepChange={() => {}}
    >
      {[
        <BasicInfoSection
          key="basics"
          initial={restaurant}
          mode="onboarding"
          onValidChange={valid => setValid(0, valid)}
        />,
        <LocationSection
          key="location"
          restaurantId={restaurant.id}
          initialAddress={restaurant.address ?? ''}
          initialLat={initialLat}
          initialLng={initialLng}
          onValidChange={valid => setValid(1, valid)}
        />,
        <HoursSection
          key="hours"
          restaurantId={restaurant.id}
          initial={{
            open_hours:
              (restaurant.open_hours as Record<string, { open: string; close: string }> | null) ??
              null,
            delivery_available: restaurant.delivery_available,
            takeout_available: restaurant.takeout_available,
            dine_in_available: restaurant.dine_in_available,
            accepts_reservations: restaurant.accepts_reservations,
          }}
          onValidChange={valid => setValid(2, valid)}
        />,
        <CuisinesSection
          key="cuisines"
          restaurantId={restaurant.id}
          initialCuisines={restaurant.cuisine_types ?? []}
          restaurantName={restaurant.name}
          onValidChange={valid => setValid(3, valid)}
        />,
        <PhotosSection
          key="photos"
          restaurantId={restaurant.id}
          initialImageUrl={restaurant.image_url}
          onValidChange={valid => setValid(4, valid)}
        />,
      ]}
    </OnboardingStepper>
  );
}
