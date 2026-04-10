'use client';

import { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { COUNTRIES } from '@/lib/constants';
import type { ParsedLocationDetails } from '@/lib/parseAddress';
import { toast } from 'sonner';
import type { BasicInfoFormData } from './types';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="card" />,
});

interface LocationSectionProps {
  mapCoordinates: { lat: number; lng: number } | null;
  onMapCoordinatesChange: (coords: { lat: number; lng: number }) => void;
  country: string;
  onCountryChange: (country: string) => void;
}

export function LocationSection({
  mapCoordinates,
  onMapCoordinatesChange,
  country,
  onCountryChange,
}: LocationSectionProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<BasicInfoFormData>();

  const handleLocationSelect = useCallback(
    (lat: number, lng: number) => {
      setValue('location_lat', lat.toString());
      setValue('location_lng', lng.toString());
      onMapCoordinatesChange({ lat, lng });
      toast.success('Location marked on map!');
    },
    [setValue, onMapCoordinatesChange]
  );

  const handleAddressSelect = useCallback(
    (address: string) => {
      setValue('address', address);
    },
    [setValue]
  );

  const handleLocationDetails = useCallback(
    (details: ParsedLocationDetails) => {
      if (details.city) setValue('city', details.city);
      if (details.neighbourhood) setValue('neighbourhood', details.neighbourhood);
      if (details.state) setValue('state', details.state);
      if (details.postalCode) setValue('postal_code', details.postalCode);

      const supportedCountry = COUNTRIES.find(c => c.value === details.countryCode);
      if (supportedCountry) {
        onCountryChange(details.countryCode);
        setValue('country', details.countryCode);
      }

      toast.success('Location details auto-filled!');
    },
    [setValue, onCountryChange]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location
        </CardTitle>
        <CardDescription>Where can customers find you?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
          <p>
            Click anywhere on the map to pin your restaurant. Country, city, postal code and address
            will be auto-filled — you can still edit them manually.
          </p>
        </div>

        <LocationPicker
          initialLat={mapCoordinates?.lat}
          initialLng={mapCoordinates?.lng}
          onLocationSelect={handleLocationSelect}
          onAddressSelect={handleAddressSelect}
          onLocationDetails={handleLocationDetails}
        />

        <div>
          <Label htmlFor="country" className="mb-2 block">
            Country <span className="text-red-500">*</span>
          </Label>
          <Select
            value={country}
            onValueChange={value => {
              onCountryChange(value);
              setValue('country', value);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city" className="mb-2 block">
              City
            </Label>
            <Input id="city" {...register('city')} placeholder="San Francisco" />
          </div>
          <div>
            <Label htmlFor="postal_code" className="mb-2 block">
              Postal Code
            </Label>
            <Input id="postal_code" {...register('postal_code')} placeholder="94102" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="neighbourhood" className="mb-2 block">
              Neighbourhood{' '}
              <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </Label>
            <Input id="neighbourhood" {...register('neighbourhood')} placeholder="Downtown" />
          </div>
          <div>
            <Label htmlFor="state" className="mb-2 block">
              State / Province
            </Label>
            <Input id="state" {...register('state')} placeholder="California" />
          </div>
        </div>

        <div>
          <Label htmlFor="address" className="mb-2 block">
            Full Address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="address"
            {...register('address', { required: true })}
            placeholder="123 Main Street, City, State, ZIP"
            className={errors.address ? 'border-red-500' : ''}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="location_lat" className="mb-2 block">
              Latitude
            </Label>
            <Input
              id="location_lat"
              {...register('location_lat')}
              placeholder="40.7128"
              type="number"
              step="any"
              readOnly
            />
          </div>
          <div>
            <Label htmlFor="location_lng" className="mb-2 block">
              Longitude
            </Label>
            <Input
              id="location_lng"
              {...register('location_lng')}
              placeholder="-74.0060"
              type="number"
              step="any"
              readOnly
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
