'use client';

import { useState } from 'react';
import { updateRestaurantLocation } from '@/app/(app)/restaurant/[id]/actions/restaurant';

interface GeocodingFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface Props {
  restaurantId: string;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  onValidChange?: (valid: boolean) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function LocationSection({
  restaurantId,
  initialAddress = '',
  initialLat,
  initialLng,
  onValidChange,
}: Props) {
  const [addressInput, setAddressInput] = useState(initialAddress);
  const [lat, setLat] = useState<number | undefined>(initialLat);
  const [lng, setLng] = useState<number | undefined>(initialLng);
  const [results, setResults] = useState<GeocodingFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

  async function handleSearch() {
    if (!addressInput.trim()) return;
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const encoded = encodeURIComponent(addressInput.trim());
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxToken}&limit=5`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Geocoding request failed');
      const json = (await res.json()) as { features: GeocodingFeature[] };
      setResults(json.features ?? []);
      if ((json.features ?? []).length === 0) {
        setSearchError('No results found. Try a more specific address.');
      }
    } catch {
      setSearchError('Failed to search. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSelect(feature: GeocodingFeature) {
    const [selectedLng, selectedLat] = feature.center;
    setLat(selectedLat);
    setLng(selectedLng);
    setAddressInput(feature.place_name);
    setResults([]);

    setSaveState('saving');
    setFormError(null);
    onValidChange?.(true);

    const result = await updateRestaurantLocation(restaurantId, {
      lat: selectedLat,
      lng: selectedLng,
      address: feature.place_name,
    });

    if (!result.ok) {
      setSaveState('error');
      setFormError(result.formError ?? 'Save failed');
      onValidChange?.(false);
      return;
    }

    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Step 2: Location</h2>
        <div>
          {saveState === 'saving' && (
            <span className="text-sm text-muted-foreground">Saving...</span>
          )}
          {saveState === 'saved' && <span className="text-sm text-green-600">Location saved.</span>}
          {saveState === 'error' && <span className="text-sm text-red-600">Failed to save.</span>}
        </div>
      </div>

      <div className="space-y-3">
        <label htmlFor="location-address" className="block text-sm font-medium">
          Address search
        </label>
        <div className="flex gap-2">
          <input
            id="location-address"
            type="text"
            value={addressInput}
            onChange={e => setAddressInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="123 Main St, City, State"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !addressInput.trim()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchError && <p className="text-xs text-red-600">{searchError}</p>}
        {formError && <p className="text-xs text-red-600">{formError}</p>}

        {results.length > 0 && (
          <ul className="border border-border rounded-md divide-y divide-border">
            {results.map((feature, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleSelect(feature)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {feature.place_name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {lat !== undefined && lng !== undefined && (
          <div className="mt-4 p-3 rounded-md bg-muted text-sm space-y-1">
            <p className="font-medium">Selected coordinates</p>
            <p className="text-muted-foreground">
              Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
            </p>
            <p className="text-muted-foreground text-xs">
              Stored as POINT({lng} {lat}) (PostGIS format)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
