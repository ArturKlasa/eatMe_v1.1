'use client';

import { useEffect, useState } from 'react';
import { Store, Utensils, Users, Activity, AlertCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { RestaurantTable } from '@/components/admin/RestaurantTable';
import { Search } from 'lucide-react';

/**
 * SECURITY: Admin Restaurants Management Page
 *
 * Features:
 * - List all restaurants (not just user's own)
 * - Search and filter
 * - Quick actions (view, edit, suspend, delete)
 * - All actions logged in audit trail
 *
 * @security Protected by AdminLayout + RLS policies
 */

export default function AdminRestaurantsPage() {
  const [restaurantsWithCounts, setRestaurantsWithCounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRestaurants = async () => {
      console.log('[Admin] Starting restaurant fetch...');

      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('[Admin] Restaurant query result:', {
        count: restaurants?.length,
        error,
        data: restaurants,
      });

      if (error) {
        console.error('[Admin] Error fetching restaurants:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        setLoading(false);
        return;
      }

      const mapped = (restaurants || []).map(restaurant => ({
        ...restaurant,
        menuCount: 0,
        dishCount: 0,
      }));

      console.log('[Admin] Mapped restaurants:', mapped.length);
      setRestaurantsWithCounts(mapped);
      setLoading(false);
    };

    loadRestaurants();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Restaurants</h1>
          <p className="mt-2 text-gray-600">
            Manage all restaurants on the platform. Total: {restaurantsWithCounts.length}
          </p>
        </div>

        <Link
          href="/admin/restaurants/new"
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Restaurant
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search restaurants..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Status Filter */}
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Restaurant Table */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-600">
          Loading restaurants...
        </div>
      ) : (
        <RestaurantTable restaurants={restaurantsWithCounts} />
      )}
    </div>
  );
}
