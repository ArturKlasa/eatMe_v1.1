'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { InfoBox } from '@/components/InfoBox';
import { COUNTRIES } from '@eatme/shared';
import type { ParsedLocationDetails } from '@/lib/parseAddress';
import { toast } from 'sonner';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="card" />,
});

export interface LocationData {
  country: string;
  address: string;
  city: string;
  neighborhood: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
}

interface LocationFormSectionProps {
  value: LocationData;
  onChange: (location: LocationData) => void;
}

export function LocationFormSection({ value, onChange }: LocationFormSectionProps) {
  const handleLocationSelect = useCallback(
    (lat: number, lng: number) => {
      onChange({ ...value, lat, lng });
      toast.success('Location marked on map!');
    },
    [value, onChange]
  );

  const handleAddressSelect = useCallback(
    (address: string) => {
      onChange({ ...value, address });
    },
    [value, onChange]
  );

  const handleLocationDetails = useCallback(
    (details: ParsedLocationDetails) => {
      const updates: Partial<LocationData> = {};
      if (details.city) updates.city = details.city;
      if (details.neighbourhood) updates.neighborhood = details.neighbourhood;
      if (details.state) updates.state = details.state;
      if (details.postalCode) updates.postalCode = details.postalCode;
      const supportedCountry = COUNTRIES.find(c => c.value === details.countryCode);
      if (supportedCountry) updates.country = details.countryCode;
      onChange({ ...value, ...updates });
    },
    [value, onChange]
  );

  return (
    <div className="space-y-4">
      <InfoBox variant="info" icon={<MapPin className="h-4 w-4" />}>
        Click anywhere on the map to pin the restaurant. Country, city, postal code and address
        will be auto-filled — you can still edit them manually.
      </InfoBox>

      <LocationPicker
        initialLat={value.lat || undefined}
        initialLng={value.lng || undefined}
        onLocationSelect={handleLocationSelect}
        onAddressSelect={handleAddressSelect}
        onLocationDetails={handleLocationDetails}
      />

      <div>
        <Label htmlFor="lfs-country" className="mb-2 block">
          Country <span className="text-destructive">*</span>
        </Label>
        <Select
          value={value.country}
          onValueChange={country => onChange({ ...value, country })}
        >
          <SelectTrigger id="lfs-country" className="w-full">
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
          <Label htmlFor="lfs-city" className="mb-2 block">
            City
          </Label>
          <Input
            id="lfs-city"
            value={value.city}
            onChange={e => onChange({ ...value, city: e.target.value })}
            placeholder="San Francisco"
          />
        </div>
        <div>
          <Label htmlFor="lfs-postal" className="mb-2 block">
            Postal Code
          </Label>
          <Input
            id="lfs-postal"
            value={value.postalCode}
            onChange={e => onChange({ ...value, postalCode: e.target.value })}
            placeholder="94102"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lfs-neighbourhood" className="mb-2 block">
            Neighbourhood{' '}
            <span className="text-muted-foreground font-normal text-xs">(optional)</span>
          </Label>
          <Input
            id="lfs-neighbourhood"
            value={value.neighborhood}
            onChange={e => onChange({ ...value, neighborhood: e.target.value })}
            placeholder="Downtown"
          />
        </div>
        <div>
          <Label htmlFor="lfs-state" className="mb-2 block">
            State / Province
          </Label>
          <Input
            id="lfs-state"
            value={value.state}
            onChange={e => onChange({ ...value, state: e.target.value })}
            placeholder="California"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="lfs-address" className="mb-2 block">
          Full Address <span className="text-destructive">*</span>
        </Label>
        <Input
          id="lfs-address"
          value={value.address}
          onChange={e => onChange({ ...value, address: e.target.value })}
          placeholder="123 Main Street, City, State, ZIP"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lfs-lat" className="mb-2 block">
            Latitude
          </Label>
          <Input
            id="lfs-lat"
            value={value.lat || ''}
            readOnly
            placeholder="Click map to set"
          />
        </div>
        <div>
          <Label htmlFor="lfs-lng" className="mb-2 block">
            Longitude
          </Label>
          <Input
            id="lfs-lng"
            value={value.lng || ''}
            readOnly
            placeholder="Click map to set"
          />
        </div>
      </div>
    </div>
  );
}
