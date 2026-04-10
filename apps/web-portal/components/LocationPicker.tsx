'use client';

/**
 * Interactive map component for picking a restaurant's physical location.
 *
 * Uses Leaflet (dynamically imported to avoid SSR crashes) with OpenStreetMap
 * tiles. When the user clicks the map:
 *   1. A draggable marker is placed at the clicked coordinates.
 *   2. `onLocationSelect(lat, lng)` fires so the parent form can update its
 *      hidden lat/lng fields.
 *   3. Nominatim reverse-geocoding is called to derive a human-readable
 *      street address and structured location details (city, postal code, etc.).
 *
 * The Leaflet instance is created only once (when `userLocation` is first
 * resolved) and never re-created on subsequent clicks — marker position is
 * updated in place via `setLatLng()` to avoid flickering and map resets.
 *
 * Geolocation falls back to New York (40.71, -74.00) when the browser
 * doesn't support the API or the user denies the permission prompt.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type L from 'leaflet';
import { parseNominatimAddress, type ParsedLocationDetails } from '@/lib/parseAddress';
import { toast } from 'sonner';

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressSelect?: (address: string) => void;
  /**
   * Called after a successful reverse-geocoding lookup with structured address
   * fields (city, postalCode, countryCode, etc.) so parent forms can auto-fill
   * their inputs without needing to parse the raw display_name themselves.
   */
  onLocationDetails?: (details: ParsedLocationDetails) => void;
}

export default function LocationPicker({
  initialLat,
  initialLng,
  onLocationSelect,
  onAddressSelect,
  onLocationDetails,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [mapLoading, setMapLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const lastGeocodeRef = useRef<number>(0);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        error => {
          if (error.code === error.PERMISSION_DENIED) {
            toast.warning('Location access denied. Showing default location — click the map to set your restaurant\'s position.');
          }
          // Default to a central location if geolocation fails
          setUserLocation({ lat: 40.7128, lng: -74.006 }); // New York
        }
      );
    } else {
      toast.warning('Geolocation is not supported by your browser. Click the map to set your restaurant\'s position.');
      setUserLocation({ lat: 40.7128, lng: -74.006 }); // New York
    }
  }, []);

  // ── Initialise Leaflet map once we know the user's starting location ──────
  // Leaflet is imported dynamically here because it accesses `window` and
  // `document` directly — importing it at the top level crashes Next.js SSR.
  useEffect(() => {
    // Only initialize map when we have a location and the container is ready
    if (!userLocation || !mapContainerRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    const initializeMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      // Fix for default marker icons in webpack
      const iconDefault = L.Icon.Default.prototype as unknown as Record<string, unknown>;
      delete iconDefault._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      // Don't reinitialize if map already exists
      if (mapRef.current) return;

      const center = selectedLocation || userLocation;

      if (!mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add marker if there's a selected location
      if (selectedLocation) {
        markerRef.current = L.marker([selectedLocation.lat, selectedLocation.lng]).addTo(map);
      }

      // Handle map clicks
      map.on('click', async (e: L.LeafletMouseEvent) => {
        // Prevent any default/propagation that could submit the parent form
        if (e.originalEvent) {
          e.originalEvent.preventDefault();
          e.originalEvent.stopPropagation();
        }

        const { lat, lng } = e.latlng;

        // Update or create marker
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        setSelectedLocation({ lat, lng });
        onLocationSelect(lat, lng);

        // Perform reverse geocoding when at least one detail callback is provided
        // Throttle to max 1 request per second
        if (onAddressSelect || onLocationDetails) {
          const now = Date.now();
          const timeSinceLast = now - lastGeocodeRef.current;
          if (timeSinceLast < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
          }
          lastGeocodeRef.current = Date.now();

          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;

            const response = await fetch(url, {
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'EatMe-Restaurant-App',
              },
            });

            if (response.ok) {
              const data = await response.json();

              const parsed = data.address
                ? parseNominatimAddress(data.display_name || '', data.address)
                : null;

              if (onAddressSelect) {
                const streetAddress = parsed?.streetAddress || '';
                onAddressSelect(streetAddress);
              }

              // Emit structured details so parent forms can auto-fill country,
              // city and postal code fields.
              if (onLocationDetails && parsed) {
                onLocationDetails(parsed);
              }
            }
          } catch {
            // Reverse geocoding failed — non-critical, user can fill address manually
          }
        }
      });

      mapRef.current = map;
      setMapLoading(false);
    };

    initializeMap();

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]); // Removed selectedLocation to prevent map recreation on every click

  return (
    <div className="space-y-3">
      <div className="relative">
        {mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg z-10">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span className="text-sm">Loading map...</span>
            </div>
          </div>
        )}
        <div
          ref={mapContainerRef}
          aria-label="Restaurant location map"
          className="w-full h-64 rounded-lg border-2 border-gray-300 relative z-0"
          style={{ minHeight: '256px' }}
        />
      </div>
    </div>
  );
}
