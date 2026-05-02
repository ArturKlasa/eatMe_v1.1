'use client';

import { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import { Search, Loader2 } from 'lucide-react';

export interface AreaSelection {
  lat: number;
  lng: number;
  radius: number; // meters
}

interface ImportAreaSelectorProps {
  onAreaSelect: (area: AreaSelection) => void;
}

const DEFAULT_LAT = 19.4326;
const DEFAULT_LNG = -99.1332;
const DEFAULT_ZOOM = 12;
const DEFAULT_RADIUS_KM = 5;

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function ImportAreaSelector({ onAreaSelect }: ImportAreaSelectorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const LRef = useRef<typeof L | null>(null);
  const lastGeocodeRef = useRef<number>(0);
  const onAreaSelectRef = useRef(onAreaSelect);
  const radiusRef = useRef(DEFAULT_RADIUS_KM * 1000);

  const [mapLoading, setMapLoading] = useState(true);
  const [selectedLatLng, setSelectedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [citySearch, setCitySearch] = useState('');
  const [citySearching, setCitySearching] = useState(false);
  const [selectionLabel, setSelectionLabel] = useState<string>('');

  useEffect(() => {
    onAreaSelectRef.current = onAreaSelect;
  }, [onAreaSelect]);

  useEffect(() => {
    const meters = radiusKm * 1000;
    radiusRef.current = meters;
    if (circleRef.current) {
      circleRef.current.setRadius(meters);
    }
  }, [radiusKm]);

  useEffect(() => {
    if (selectedLatLng) {
      onAreaSelectRef.current({
        lat: selectedLatLng.lat,
        lng: selectedLatLng.lng,
        radius: radiusRef.current,
      });
    }
  }, [selectedLatLng, radiusKm]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      // Default marker icons can't resolve their bundled image paths under
      // Next's bundler, so point them at a CDN copy.
      const iconDefault = L.Icon.Default.prototype as unknown as Record<string, unknown>;
      delete iconDefault._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      if (mapRef.current) return;
      if (!mapContainerRef.current) return;

      LRef.current = L;

      const map = L.map(mapContainerRef.current).setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        placeMarkerCircle(L, map, lat, lng);
        setSelectedLatLng({ lat, lng });
        setSelectionLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      });

      mapRef.current = map;
      setMapLoading(false);
    };

    initMap().catch(() => setMapLoading(false));

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
        LRef.current = null;
      }
    };
  }, []);

  function placeMarkerCircle(L: typeof import('leaflet'), map: L.Map, lat: number, lng: number) {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    }

    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(radiusRef.current);
    } else {
      circleRef.current = L.circle([lat, lng], {
        radius: radiusRef.current,
        color: '#f97316',
        fillColor: '#f97316',
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);
    }
  }

  const handleCitySearch = async () => {
    const query = citySearch.trim();
    if (!query || !mapRef.current || !LRef.current) return;

    // Nominatim usage policy: max 1 req/sec.
    const now = Date.now();
    const timeSinceLast = now - lastGeocodeRef.current;
    if (timeSinceLast < 1000) {
      await new Promise<void>(resolve => setTimeout(resolve, 1000 - timeSinceLast));
    }
    lastGeocodeRef.current = Date.now();

    setCitySearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'EatMe-Admin',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as Array<{
          lat: string;
          lon: string;
          display_name: string;
        }>;
        if (data.length > 0) {
          const { lat, lon, display_name } = data[0];
          const latNum = parseFloat(lat);
          const lngNum = parseFloat(lon);

          mapRef.current.setView([latNum, lngNum], 13);
          placeMarkerCircle(LRef.current, mapRef.current, latNum, lngNum);
          setSelectedLatLng({ lat: latNum, lng: lngNum });
          const parts = display_name.split(',');
          const shortLabel =
            parts.length >= 2
              ? `${parts[0].trim()}, ${parts[parts.length - 1].trim()}`
              : display_name;
          setSelectionLabel(shortLabel);
        }
      }
    } catch {
      // Geocoding is best-effort; user can still click the map.
    } finally {
      setCitySearching(false);
    }
  };

  const handleCitySearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCitySearch().catch(() => {});
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search city (e.g. Mexico City, Guadalajara)..."
            value={citySearch}
            onChange={e => setCitySearch(e.target.value)}
            onKeyDown={handleCitySearchKeyDown}
            className={`${inputClass} pl-9`}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            handleCitySearch().catch(() => {});
          }}
          disabled={citySearching || !citySearch.trim()}
          className="rounded-md border border-input bg-background px-4 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {citySearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Go'}
        </button>
      </div>

      <div className="relative">
        {mapLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading map…</span>
            </div>
          </div>
        )}
        <div
          ref={mapContainerRef}
          aria-label="Restaurant import area map — click to select search center"
          className="relative z-0 w-full rounded-lg border border-input"
          style={{ height: '320px' }}
        />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <label htmlFor="radius-slider">Search radius</label>
          <span className="font-medium text-foreground">{radiusKm} km</span>
        </div>
        <input
          id="radius-slider"
          type="range"
          min={1}
          max={50}
          step={1}
          value={radiusKm}
          onChange={e => setRadiusKm(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 km</span>
          <span>50 km</span>
        </div>
      </div>

      {selectedLatLng ? (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm">
          <span className="font-medium text-orange-700">Selected:</span>
          <span className="text-orange-700">
            {selectionLabel || `${selectedLatLng.lat.toFixed(4)}, ${selectedLatLng.lng.toFixed(4)}`}{' '}
            — {radiusKm} km radius
          </span>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-1">
          Click on the map or search a city to set the import area
        </p>
      )}
    </div>
  );
}
