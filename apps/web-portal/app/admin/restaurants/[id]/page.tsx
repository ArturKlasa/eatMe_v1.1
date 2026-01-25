'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Edit, Ban, CheckCircle, Loader2, MapPin, Phone, Globe } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country_code: string;
  phone: string;
  website: string;
  restaurant_type: string;
  cuisine_types: string[];
  location: { lat: number; lng: number };
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  accepts_reservations: boolean;
  is_active: boolean;
  suspended_at: string | null;
  suspended_by: string | null;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

export default function RestaurantDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', restaurantId)
          .single();

        if (error) {
          console.error('[Admin] Error fetching restaurant:', error);
          toast.error('Failed to load restaurant');
          router.push('/admin/restaurants');
          return;
        }

        setRestaurant(data);
      } catch (error) {
        console.error('[Admin] Unexpected error:', error);
        toast.error('An unexpected error occurred');
        router.push('/admin/restaurants');
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [restaurantId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/restaurants" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{restaurant.name}</h1>
            <p className="mt-2 text-gray-600">Restaurant Details</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/admin/restaurants/${restaurant.id}/menus`}
            className="flex items-center gap-2 px-4 py-2 border border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50"
          >
            Manage Menus
          </Link>
          <Link
            href={`/admin/restaurants/${restaurant.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Edit className="h-5 w-5" />
            Edit Restaurant
          </Link>
        </div>
      </div>

      {/* Status Alert */}
      {!restaurant.is_active && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Ban className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Restaurant Suspended</h3>
              {restaurant.suspension_reason && (
                <p className="text-sm text-red-700 mt-1">{restaurant.suspension_reason}</p>
              )}
              {restaurant.suspended_at && (
                <p className="text-xs text-red-600 mt-1">
                  Suspended on {new Date(restaurant.suspended_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Restaurant Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{restaurant.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Type</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">
                  {restaurant.restaurant_type}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm font-medium text-gray-500">Cuisine Types</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {restaurant.cuisine_types.map(cuisine => (
                    <span
                      key={cuisine}
                      className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full"
                    >
                      {cuisine}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          {/* Location */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Location</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-900">{restaurant.address}</p>
                  <p className="text-sm text-gray-600">
                    {restaurant.city}
                    {restaurant.postal_code && `, ${restaurant.postal_code}`}
                  </p>
                  <p className="text-sm text-gray-600">{restaurant.country_code}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">Coordinates</p>
                <p className="text-sm text-gray-900 mt-1">
                  {restaurant.location?.lat?.toFixed(6)}, {restaurant.location?.lng?.toFixed(6)}
                </p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
            <dl className="space-y-3">
              {restaurant.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <dt className="text-xs text-gray-500">Phone</dt>
                    <dd className="text-sm text-gray-900">{restaurant.phone}</dd>
                  </div>
                </div>
              )}
              {restaurant.website && (
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-gray-400" />
                  <div>
                    <dt className="text-xs text-gray-500">Website</dt>
                    <dd className="text-sm text-gray-900">
                      <a
                        href={restaurant.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:underline"
                      >
                        {restaurant.website}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Status</h2>
            <div className="space-y-3">
              {restaurant.is_active ? (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700">
                  <Ban className="h-5 w-5" />
                  <span className="font-medium">Suspended</span>
                </div>
              )}
            </div>
          </div>

          {/* Service Options */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Options</h2>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${restaurant.delivery_available ? 'bg-green-500' : 'bg-gray-300'}`}
                />
                Delivery {restaurant.delivery_available ? 'Available' : 'Not Available'}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${restaurant.takeout_available ? 'bg-green-500' : 'bg-gray-300'}`}
                />
                Takeout {restaurant.takeout_available ? 'Available' : 'Not Available'}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${restaurant.dine_in_available ? 'bg-green-500' : 'bg-gray-300'}`}
                />
                Dine-in {restaurant.dine_in_available ? 'Available' : 'Not Available'}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${restaurant.accepts_reservations ? 'bg-green-500' : 'bg-gray-300'}`}
                />
                Reservations {restaurant.accepts_reservations ? 'Accepted' : 'Not Accepted'}
              </li>
            </ul>
          </div>

          {/* Metadata */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Metadata</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900 mt-1">
                  {new Date(restaurant.created_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Last Updated</dt>
                <dd className="text-gray-900 mt-1">
                  {new Date(restaurant.updated_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Owner ID</dt>
                <dd className="text-gray-900 mt-1 font-mono text-xs break-all">
                  {restaurant.owner_id}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
