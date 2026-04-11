'use client';

import { MapPin, ScanLine, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';
import type { RestaurantOption, RestaurantDetailsForm } from '@/app/admin/menu-scan/hooks/useMenuScanState';

const LocationPickerComponent = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-48 rounded-lg border bg-muted/50 flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

export interface MenuScanProcessingProps {
  imageFiles: File[];
  selectedRestaurant: RestaurantOption | null;
  processingStage: 'resizing' | 'sending' | 'analyzing';
  restaurantDetails: RestaurantDetailsForm;
  updateRestaurantDetails: (patch: Partial<RestaurantDetailsForm>) => void;
}

export function MenuScanProcessing({
  imageFiles,
  selectedRestaurant,
  processingStage,
  restaurantDetails,
  updateRestaurantDetails,
}: MenuScanProcessingProps) {
  return (
    <div className="flex gap-8 min-h-[70vh]">
      {/* Left: AI progress */}
      <div className="w-72 shrink-0 flex flex-col items-center justify-center text-center space-y-5">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-brand-primary/10 border-t-brand-primary animate-spin" />
          <ScanLine className="absolute inset-0 m-auto h-8 w-8 text-brand-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Extracting menu…</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {imageFiles.length} image{imageFiles.length > 1 ? 's' : ''} · GPT-4o Vision
          </p>
          {selectedRestaurant && (
            <p className="text-sm text-brand-primary mt-1 font-medium">{selectedRestaurant.name}</p>
          )}
        </div>
        {/* Processing stages progress */}
        <div className="w-full space-y-1.5 text-xs">
          {(['resizing', 'sending', 'analyzing'] as const).map(stage => {
            const labels = { resizing: 'Resizing images', sending: 'Sending to AI', analyzing: 'Analysing menu' };
            const stageOrder = { resizing: 0, sending: 1, analyzing: 2 };
            const current = stageOrder[processingStage];
            const isComplete = stageOrder[stage] < current;
            const isCurrent = stage === processingStage;
            return (
              <div key={stage} className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${isComplete ? 'bg-success' : isCurrent ? 'bg-brand-primary animate-pulse' : 'bg-muted'}`} />
                <span className={isComplete ? 'text-success' : isCurrent ? 'text-brand-primary font-medium' : 'text-muted-foreground'}>{labels[stage]}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">10–30 seconds. Use the time to fill in details →</p>
      </div>

      {/* Right: restaurant details form */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-background rounded-xl border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-brand-primary" />
            <h2 className="font-semibold text-foreground">Restaurant Details</h2>
            <span className="text-xs text-muted-foreground">(optional — saved with the menu)</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Address</label>
              <Input
                value={restaurantDetails.address}
                onChange={e => updateRestaurantDetails({ address: e.target.value })}
                placeholder="e.g. Av. Chapultepec 123"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">City</label>
              <Input
                value={restaurantDetails.city}
                onChange={e => updateRestaurantDetails({ city: e.target.value })}
                placeholder="e.g. Guadalajara"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Postal Code</label>
              <Input
                value={restaurantDetails.postal_code}
                onChange={e => updateRestaurantDetails({ postal_code: e.target.value })}
                placeholder="e.g. 44100"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Neighbourhood</label>
              <Input
                value={restaurantDetails.neighbourhood}
                onChange={e => updateRestaurantDetails({ neighbourhood: e.target.value })}
                placeholder="e.g. Zona Rosa"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Country</label>
              <select
                value={restaurantDetails.country_code}
                onChange={e => updateRestaurantDetails({ country_code: e.target.value })}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:border-brand-primary/70"
              >
                <option value="MX">🇲🇽 Mexico</option>
                <option value="US">🇺🇸 United States</option>
                <option value="ES">🇪🇸 Spain</option>
                <option value="AR">🇦🇷 Argentina</option>
                <option value="CO">🇨🇴 Colombia</option>
                <option value="CL">🇨🇱 Chile</option>
                <option value="PE">🇵🇪 Peru</option>
                <option value="PL">🇵🇱 Poland</option>
                <option value="GB">🇬🇧 UK</option>
                <option value="DE">🇩🇪 Germany</option>
                <option value="CA">🇨🇦 Canada</option>
                <option value="AU">🇦🇺 Australia</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
              <Input
                value={restaurantDetails.phone}
                onChange={e => updateRestaurantDetails({ phone: e.target.value })}
                placeholder="+52 33 1234 5678"
                type="tel"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Website</label>
              <Input
                value={restaurantDetails.website}
                onChange={e => updateRestaurantDetails({ website: e.target.value })}
                placeholder="https://"
                type="url"
              />
            </div>
          </div>

          {/* Map */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Pin Location on Map
              {restaurantDetails.lat && (
                <span className="text-success ml-1">
                  ✓ {restaurantDetails.lat.toFixed(5)}, {restaurantDetails.lng?.toFixed(5)}
                </span>
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
      </div>
    </div>
  );
}
