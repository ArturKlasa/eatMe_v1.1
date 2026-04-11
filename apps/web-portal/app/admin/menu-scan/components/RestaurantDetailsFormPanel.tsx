'use client';

import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';
import type { RestaurantDetailsForm } from '@/app/admin/menu-scan/hooks/menuScanTypes';

const LocationPickerComponent = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-48 rounded-lg border bg-muted/50 flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

export interface RestaurantDetailsFormPanelProps {
  restaurantDetails: RestaurantDetailsForm;
  updateRestaurantDetails: (patch: Partial<RestaurantDetailsForm>) => void;
}

export function RestaurantDetailsFormPanel({
  restaurantDetails,
  updateRestaurantDetails,
}: RestaurantDetailsFormPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Address</label>
        <Input
          value={restaurantDetails.address}
          onChange={e => updateRestaurantDetails({ address: e.target.value })}
          placeholder="Street address"
          className="text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">City</label>
        <Input
          value={restaurantDetails.city}
          onChange={e => updateRestaurantDetails({ city: e.target.value })}
          placeholder="City"
          className="text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Postal Code</label>
        <Input
          value={restaurantDetails.postal_code}
          onChange={e => updateRestaurantDetails({ postal_code: e.target.value })}
          placeholder="e.g. 44100"
          className="text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Neighbourhood</label>
        <Input
          value={restaurantDetails.neighbourhood}
          onChange={e => updateRestaurantDetails({ neighbourhood: e.target.value })}
          placeholder="e.g. Zona Rosa"
          className="text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
        <Input
          value={restaurantDetails.phone}
          onChange={e => updateRestaurantDetails({ phone: e.target.value })}
          placeholder="+52 33 …"
          type="tel"
          className="text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Website</label>
        <Input
          value={restaurantDetails.website}
          onChange={e => updateRestaurantDetails({ website: e.target.value })}
          placeholder="https://"
          type="url"
          className="text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Location
          {restaurantDetails.lat && (
            <span className="text-success text-[10px] ml-1">✓ pinned</span>
          )}
        </label>
        <LocationPickerComponent
          onLocationSelect={(lat, lng) => updateRestaurantDetails({ lat, lng })}
          onAddressSelect={addr => {
            updateRestaurantDetails({ address: addr });
          }}
          onLocationDetails={details => {
            const patch: Partial<RestaurantDetailsForm> = {};
            if (details.city) patch.city = details.city;
            if (details.neighbourhood) patch.neighbourhood = details.neighbourhood;
            if (details.state) patch.state = details.state;
            if (details.postalCode) patch.postal_code = details.postalCode;
            if (details.countryCode) patch.country_code = details.countryCode.toUpperCase();
            updateRestaurantDetails(patch);
            toast.success('Location details auto-filled!');
          }}
        />
      </div>
    </div>
  );
}
