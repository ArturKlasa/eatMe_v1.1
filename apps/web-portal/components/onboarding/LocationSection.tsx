'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LocationFormSection } from '@/components/LocationFormSection';
import type { LocationData } from '@/components/LocationFormSection';
import type { BasicInfoFormData } from './types';

const EMPTY_LOCATION: LocationData = {
  country: 'US',
  address: '',
  city: '',
  neighborhood: '',
  state: '',
  postalCode: '',
  lat: 0,
  lng: 0,
};

export function LocationSection() {
  const { control } = useFormContext<BasicInfoFormData>();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location
        </CardTitle>
        <CardDescription>Where can customers find you?</CardDescription>
      </CardHeader>
      <CardContent>
        <Controller
          name="location"
          control={control}
          defaultValue={EMPTY_LOCATION}
          render={({ field }) => (
            <LocationFormSection value={field.value ?? EMPTY_LOCATION} onChange={field.onChange} />
          )}
        />
      </CardContent>
    </Card>
  );
}
