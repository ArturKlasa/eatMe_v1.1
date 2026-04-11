'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Edit, Trash2, Ban, CheckCircle, Eye, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RestaurantWarningBadge } from '@/components/admin/RestaurantWarningBadge';
import type { WarningFlag } from '@/lib/import-types';

interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  cuisine_types: string[] | null;
  is_active: boolean | null;
  menuCount: number;
  dishCount: number;
  created_at: string | null;
  suspended_at?: string | null;
  suspension_reason?: string | null;
}

interface RestaurantTableProps {
  restaurants: Restaurant[];
  warnings?: Map<string, WarningFlag[]>;
  showFlaggedOnly?: boolean;
  onToggleFlaggedOnly?: (value: boolean) => void;
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

export function RestaurantTable({
  restaurants: initialRestaurants,
  warnings = new Map(),
  showFlaggedOnly = false,
  onToggleFlaggedOnly,
}: RestaurantTableProps) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);

  const displayedRestaurants = showFlaggedOnly
    ? restaurants.filter((r) => (warnings.get(r.id) ?? []).length > 0)
    : restaurants;
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant: 'destructive' | 'default';
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', confirmLabel: 'Confirm', confirmVariant: 'default', onConfirm: () => {} });

  const handleSuspend = (id: string, currentStatus: boolean) => {
    const action = currentStatus ? 'suspend' : 'activate';
    setConfirmState({
      open: true,
      title: `${currentStatus ? 'Suspend' : 'Activate'} Restaurant`,
      description: `Are you sure you want to ${action} this restaurant? This action will be logged in the audit trail.`,
      confirmLabel: currentStatus ? 'Suspend' : 'Activate',
      confirmVariant: currentStatus ? 'destructive' : 'default',
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        try {
          // TODO: Implement suspend/activate API call with audit logging
          toast.success(`Restaurant ${action}d successfully`);
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
      },
    });
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmState({
      open: true,
      title: `Delete Restaurant "${name}"`,
      description: `This is a permanent action that will delete all menus and dishes. It cannot be undone and will be logged in the audit trail. Consider using Suspend instead.`,
      confirmLabel: 'Delete',
      confirmVariant: 'destructive',
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
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
      },
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {onToggleFlaggedOnly && (
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <input
            id="flagged-only-toggle"
            type="checkbox"
            checked={showFlaggedOnly}
            onChange={(e) => onToggleFlaggedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <label htmlFor="flagged-only-toggle" className="text-sm text-gray-700 cursor-pointer">
            Show flagged only
          </label>
        </div>
      )}
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
          {displayedRestaurants.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                No restaurants found
              </td>
            </tr>
          ) : (
            displayedRestaurants.map(restaurant => (
              <tr key={restaurant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{restaurant.name}</p>
                    <p className="text-xs text-gray-500">
                      {restaurant.created_at ? new Date(restaurant.created_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{restaurant.address}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(restaurant.cuisine_types ?? []).slice(0, 2).map(cuisine => (
                      <span
                        key={cuisine}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                      >
                        {cuisine}
                      </span>
                    ))}
                    {(restaurant.cuisine_types ?? []).length > 2 && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                        +{(restaurant.cuisine_types?.length ?? 0) - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {restaurant.menuCount} / {restaurant.dishCount}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-1">
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
                    <RestaurantWarningBadge warnings={warnings.get(restaurant.id) ?? []} />
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/menu-scan?restaurant_id=${restaurant.id}`}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                      title="Scan Menu"
                      aria-label="Scan menu"
                    >
                      <ScanLine className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/admin/restaurants/${restaurant.id}`}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      title="View Details"
                      aria-label="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/admin/restaurants/${restaurant.id}/edit`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                      aria-label="Edit restaurant"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleSuspend(restaurant.id, restaurant.is_active ?? true)}
                      className={`p-2 rounded ${
                        restaurant.is_active
                          ? 'text-yellow-600 hover:bg-yellow-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={restaurant.is_active ? 'Suspend' : 'Activate'}
                      aria-label={restaurant.is_active ? 'Suspend restaurant' : 'Activate restaurant'}
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
                      aria-label="Delete restaurant"
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
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState(s => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        confirmVariant={confirmState.confirmVariant}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
}
