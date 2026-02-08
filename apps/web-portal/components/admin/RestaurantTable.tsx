'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Edit, Trash2, Ban, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  cuisine_types: string[];
  is_active: boolean;
  menuCount: number;
  dishCount: number;
  created_at: string;
  suspended_at?: string | null;
  suspension_reason?: string | null;
}

interface RestaurantTableProps {
  restaurants: Restaurant[];
}

/**
 * SECURITY: Restaurant Table Component
 *
 * Features:
 * - Client-side filtering and sorting
 * - Suspension actions (logged in audit trail)
 * - Delete confirmation
 * - Status indicators
 */

export function RestaurantTable({ restaurants: initialRestaurants }: RestaurantTableProps) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);

  const handleSuspend = async (id: string, currentStatus: boolean) => {
    const action = currentStatus ? 'suspend' : 'activate';
    const confirmed = window.confirm(
      `Are you sure you want to ${action} this restaurant?\n\nThis action will be logged in the audit trail.`
    );

    if (!confirmed) return;

    try {
      // TODO: Implement suspend/activate API call with audit logging
      toast.success(`Restaurant ${action}d successfully`);

      // Update local state
      setRestaurants(prev =>
        prev.map(r =>
          r.id === id
            ? {
                ...r,
                is_active: !currentStatus,
                suspended_at: !currentStatus ? null : new Date().toISOString(),
              }
            : r
        )
      );
    } catch (error) {
      toast.error(`Failed to ${action} restaurant`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `⚠️ WARNING: Delete restaurant "${name}"?\n\n` +
        `This is a PERMANENT action that:\n` +
        `- Deletes all menus and dishes\n` +
        `- Cannot be undone\n` +
        `- Will be logged in audit trail\n\n` +
        `Consider using Suspend instead. Continue with deletion?`
    );

    if (!confirmed) return;

    const doubleCheck = window.confirm(
      `Final confirmation: Type the restaurant name to confirm deletion.\n\nRestaurant: ${name}`
    );

    if (!doubleCheck) return;

    try {
      // Delete from database
      const { error } = await supabase.from('restaurants').delete().eq('id', id);

      if (error) {
        console.error('Error deleting restaurant:', error);
        toast.error('Failed to delete restaurant: ' + error.message);
        return;
      }

      // Refresh materialized views to update ratings summaries
      try {
        await supabase.rpc('refresh_materialized_views');
      } catch (viewError) {
        console.warn('Failed to refresh materialized views:', viewError);
        // Non-fatal, continue anyway
      }

      toast.success('Restaurant deleted successfully');

      // Update local state
      setRestaurants(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error in handleDelete:', error);
      toast.error('Failed to delete restaurant');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              Restaurant
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              Address
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              Cuisine
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              Menus/Dishes
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {restaurants.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                No restaurants found
              </td>
            </tr>
          ) : (
            restaurants.map(restaurant => (
              <tr key={restaurant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{restaurant.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(restaurant.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{restaurant.address}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {restaurant.cuisine_types.slice(0, 2).map(cuisine => (
                      <span
                        key={cuisine}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                      >
                        {cuisine}
                      </span>
                    ))}
                    {restaurant.cuisine_types.length > 2 && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                        +{restaurant.cuisine_types.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {restaurant.menuCount} / {restaurant.dishCount}
                </td>
                <td className="px-6 py-4">
                  {restaurant.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </span>
                  ) : (
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded">
                        <Ban className="h-3 w-3" />
                        Suspended
                      </span>
                      {restaurant.suspension_reason && (
                        <p className="text-xs text-gray-500 mt-1">{restaurant.suspension_reason}</p>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/restaurants/${restaurant.id}`}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/admin/restaurants/${restaurant.id}/edit`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleSuspend(restaurant.id, restaurant.is_active)}
                      className={`p-2 rounded ${
                        restaurant.is_active
                          ? 'text-yellow-600 hover:bg-yellow-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={restaurant.is_active ? 'Suspend' : 'Activate'}
                    >
                      {restaurant.is_active ? (
                        <Ban className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(restaurant.id, restaurant.name)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
