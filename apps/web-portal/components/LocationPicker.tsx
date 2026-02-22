'use client';

import { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import { parseNominatimAddress, type ParsedLocationDetails } from '@/lib/parseAddress';

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
  console.log(
    '[LocationPicker] Component render - initialLat:',
    initialLat,
    'initialLng:',
    initialLng
  );

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Component mount/unmount logging
  useEffect(() => {
    console.log('[LocationPicker] Component MOUNTED');
    return () => {
      console.log('[LocationPicker] Component UNMOUNTING');
    };
  }, []);

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
          console.error('Error getting location:', error);
          // Default to a central location if geolocation fails
          setUserLocation({ lat: 40.7128, lng: -74.006 }); // New York
        }
      );
    } else {
      // Default location if geolocation is not supported
      setUserLocation({ lat: 40.7128, lng: -74.006 }); // New York
    }
  }, []);

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
        if (onAddressSelect || onLocationDetails) {
          try {
            console.log('[LocationPicker] Fetching reverse geocoding...');
            console.log('[LocationPicker] Coordinates:', { lat, lng });

            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
            console.log('[LocationPicker] Fetching from URL:', url);

            const response = await fetch(url, {
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'EatMe-Restaurant-App',
              },
            });

            console.log('[LocationPicker] Response status:', response.status);

            if (response.ok) {
              const data = await response.json();
              console.log('[LocationPicker] Response data:', data);

              // Parse the structured address object first so we can reuse it
              // for both callbacks without parsing twice.
              const parsed = data.address
                ? parseNominatimAddress(data.display_name || '', data.address)
                : null;

              // Fill the "Full Address" field with only the street-level part
              // (house number + road). City, postal code and country are
              // handled separately via onLocationDetails so they don't end up
              // duplicated in the address field.
              if (onAddressSelect) {
                const streetAddress = parsed?.streetAddress || '';
                console.log('[LocationPicker] Calling onAddressSelect with:', streetAddress);
                onAddressSelect(streetAddress);
              }

              // Emit structured details so parent forms can auto-fill country,
              // city and postal code fields.
              if (onLocationDetails && parsed) {
                onLocationDetails(parsed);
              }
            } else {
              const errorText = await response.text();
              console.error(
                '[LocationPicker] Reverse geocoding failed:',
                response.status,
                errorText
              );
            }
          } catch (error) {
            console.error('[LocationPicker] Error fetching address:', error);
          }
        }
      });

      mapRef.current = map;
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
      <div
        ref={mapContainerRef}
        className="w-full h-64 rounded-lg border-2 border-gray-300 relative z-0"
        style={{ minHeight: '256px' }}
      />
    </div>
  );
}
