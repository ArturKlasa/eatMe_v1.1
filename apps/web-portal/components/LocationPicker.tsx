'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import type L from 'leaflet';

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function LocationPicker({
  initialLat,
  initialLng,
  onLocationSelect,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

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
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;

        // Update or create marker
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        setSelectedLocation({ lat, lng });
        onLocationSelect(lat, lng);
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
  }, [userLocation, selectedLocation, onLocationSelect]);

  return (
    <div className="space-y-3">
      <div
        ref={mapContainerRef}
        className="w-full h-64 rounded-lg border-2 border-gray-300 relative z-0"
        style={{ minHeight: '256px' }}
      />
      <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
        <p>
          Click anywhere on the map to mark your restaurant&apos;s location. The coordinates will be
          automatically filled in the fields above.
        </p>
      </div>
    </div>
  );
}
