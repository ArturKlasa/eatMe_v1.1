'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

export default function NewRestaurantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    postal_code: '',
    country_code: 'US',
    phone: '',
    website: '',
    restaurant_type: 'restaurant',
    cuisine_types: [] as string[],
    latitude: '',
    longitude: '',
    delivery_available: false,
    takeout_available: false,
    dine_in_available: true,
    accepts_reservations: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        toast.error('Please enter valid coordinates');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Not authenticated');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('restaurants').insert({
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postal_code,
        country_code: formData.country_code,
        phone: formData.phone,
        website: formData.website,
        restaurant_type: formData.restaurant_type,
        cuisine_types: formData.cuisine_types,
        location: { lat, lng },
        open_hours: {},
        delivery_available: formData.delivery_available,
        takeout_available: formData.takeout_available,
        dine_in_available: formData.dine_in_available,
        accepts_reservations: formData.accepts_reservations,
        owner_id: userData.user.id,
        is_active: true,
      });

      if (error) {
        console.error('[Admin] Error creating restaurant:', error);
        toast.error('Failed to create restaurant');
        setLoading(false);
        return;
      }

      toast.success('Restaurant created successfully!');
      router.push('/admin/restaurants');
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
      setLoading(false);
    }
  };

  const cuisineOptions = [
    'Italian',
    'Chinese',
    'Japanese',
    'Mexican',
    'Indian',
    'Thai',
    'French',
    'American',
    'Mediterranean',
    'Korean',
    'Vietnamese',
    'Greek',
    'Spanish',
  ];

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData({
      ...formData,
      latitude: lat.toString(),
      longitude: lng.toString(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/restaurants" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Restaurant</h1>
          <p className="mt-2 text-gray-600">Create a new restaurant listing as admin</p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-lg p-6 space-y-6"
      >
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Restaurant Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Restaurant Type *
              </label>
              <select
                required
                value={formData.restaurant_type}
                onChange={e => setFormData({ ...formData, restaurant_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Cafe</option>
                <option value="bar">Bar</option>
                <option value="food-truck">Food Truck</option>
                <option value="bakery">Bakery</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cuisine Types *
              </label>
              <select
                multiple
                required
                value={formData.cuisine_types}
                onChange={e =>
                  setFormData({
                    ...formData,
                    cuisine_types: Array.from(e.target.selectedOptions, option => option.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {cuisineOptions.map(cuisine => (
                  <option key={cuisine} value={cuisine}>
                    {cuisine}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Location</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={e => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={formData.country_code}
                onChange={e => setFormData({ ...formData, country_code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
              <input
                type="number"
                step="any"
                required
                value={formData.latitude}
                onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="40.7128"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
              <input
                type="number"
                step="any"
                required
                value={formData.longitude}
                onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="-74.0060"
                readOnly
              />
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Click on the map below to mark the restaurant location and get coordinates
            automatically.
          </p>

          <LocationPicker
            initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
            initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
            onLocationSelect={handleLocationSelect}
          />
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Contact</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={e => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Service Options */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Service Options</h2>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.delivery_available}
                onChange={e => setFormData({ ...formData, delivery_available: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Delivery Available</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.takeout_available}
                onChange={e => setFormData({ ...formData, takeout_available: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Takeout Available</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.dine_in_available}
                onChange={e => setFormData({ ...formData, dine_in_available: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Dine-in Available</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.accepts_reservations}
                onChange={e => setFormData({ ...formData, accepts_reservations: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Accepts Reservations</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Restaurant
          </button>

          <Link
            href="/admin/restaurants"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
