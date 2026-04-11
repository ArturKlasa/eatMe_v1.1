'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Store, Edit, Trash2, Ban, CheckCircle, Eye, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/supabase';
import { DataTable } from '@/components/DataTable';
import type { ColumnDef } from '@/components/DataTable';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RestaurantWarningBadge } from '@/components/admin/RestaurantWarningBadge';
import { Button } from '@/components/ui/button';
import { computeWarningFlags } from '@/lib/import-service';
import type { WarningFlag } from '@/lib/import-types';
import { useFilters } from '@/hooks/useFilters';
import { usePagination } from '@/hooks/usePagination';
import { StatusBadge } from '@/components/StatusBadge';

const PAGE_SIZE = 10;

type RestaurantEntry = Restaurant & {
  menuCount: number;
  dishCount: number;
  [key: string]: unknown;
};

export default function AdminRestaurantsPage() {
  const [allRestaurants, setAllRestaurants] = useState<RestaurantEntry[]>([]);
  const [warningsMap, setWarningsMap] = useState<Map<string, WarningFlag[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant: 'destructive' | 'default';
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', confirmLabel: 'Confirm', confirmVariant: 'default', onConfirm: () => {} });

  useEffect(() => {
    const loadRestaurants = async () => {
      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Admin] Error fetching restaurants:', error);
        setLoading(false);
        return;
      }

      const rows = restaurants ?? [];

      const dishCountMap = new Map<string, number>();
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: dishRows } = await supabase
          .from('dishes')
          .select('restaurant_id')
          .in('restaurant_id', ids);
        for (const dish of dishRows ?? []) {
          if (dish.restaurant_id) {
            dishCountMap.set(dish.restaurant_id, (dishCountMap.get(dish.restaurant_id) ?? 0) + 1);
          }
        }
      }

      const mapped: RestaurantEntry[] = rows.map((restaurant) => ({
        ...restaurant,
        menuCount: 0,
        dishCount: dishCountMap.get(restaurant.id) ?? 0,
      }));

      const warnings = new Map<string, WarningFlag[]>();
      for (const restaurant of mapped) {
        warnings.set(restaurant.id, computeWarningFlags(restaurant, restaurant.dishCount as number));
      }

      setAllRestaurants(mapped);
      setWarningsMap(warnings);
      setLoading(false);
    };
    loadRestaurants();
  }, []);

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
          setAllRestaurants(prev =>
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
        } catch {
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
          const { error } = await supabase.from('restaurants').delete().eq('id', id);
          if (error) {
            console.error('Error deleting restaurant:', error);
            toast.error('Failed to delete restaurant: ' + error.message);
            return;
          }
          try {
            await supabase.rpc('refresh_materialized_views');
          } catch (viewError) {
            console.warn('Failed to refresh materialized views:', viewError);
          }
          toast.success('Restaurant deleted successfully');
          setAllRestaurants(prev => prev.filter(r => r.id !== id));
        } catch (error) {
          console.error('Error in handleDelete:', error);
          toast.error('Failed to delete restaurant');
        }
      },
    });
  };

  const filtered = useFilters<RestaurantEntry>(allRestaurants, [
    {
      value: searchQuery,
      fn: (r, v) => (r.name as string).toLowerCase().includes(v.toLowerCase()),
    },
    {
      value: statusFilter === 'all' ? '' : statusFilter,
      fn: (r, v) => (v === 'active' ? !!r.is_active : !r.is_active),
    },
    {
      value: showFlaggedOnly ? 'flagged' : '',
      fn: (r) => (warningsMap.get(r.id as string) ?? []).length > 0,
    },
  ]);

  const { page, totalPages, paginatedItems, setPage } = usePagination(
    filtered,
    PAGE_SIZE
  );

  const columns: ColumnDef<RestaurantEntry>[] = [
    {
      key: 'name',
      header: 'Restaurant',
      render: (_, row) => (
        <div>
          <p className="font-medium text-foreground">{row.name as string}</p>
          <p className="text-xs text-muted-foreground">
            {row.created_at ? new Date(row.created_at as string).toLocaleDateString() : '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Address',
    },
    {
      key: 'cuisine_types',
      header: 'Cuisine',
      render: (_, row) => {
        const cuisines = (row.cuisine_types as string[] | null) ?? [];
        return (
          <div className="flex flex-wrap gap-1">
            {cuisines.slice(0, 2).map(cuisine => (
              <span key={cuisine} className="text-xs px-2 py-1 bg-muted/30 text-foreground rounded">
                {cuisine}
              </span>
            ))}
            {cuisines.length > 2 && (
              <span className="text-xs px-2 py-1 bg-muted/30 text-foreground rounded">
                +{cuisines.length - 2}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'menuCount',
      header: 'Menus/Dishes',
      render: (_, row) => `${row.menuCount as number} / ${row.dishCount as number}`,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_, row) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge variant={row.is_active ? 'active' : 'inactive'} label={row.is_active ? 'Active' : 'Suspended'} />
          {!row.is_active && row.suspension_reason && (
            <p className="text-xs text-muted-foreground mt-1 w-full">{row.suspension_reason as string}</p>
          )}
          <RestaurantWarningBadge warnings={warningsMap.get(row.id as string) ?? []} />
        </div>
      ),
    },
  ];

  const renderActions = (row: RestaurantEntry) => (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/admin/menu-scan?restaurant_id=${row.id as string}`}
        className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded"
        title="Scan Menu"
        aria-label="Scan menu"
      >
        <ScanLine className="h-4 w-4" />
      </Link>
      <Link
        href={`/admin/restaurants/${row.id as string}`}
        className="p-2 text-muted-foreground hover:bg-accent rounded"
        title="View Details"
        aria-label="View details"
      >
        <Eye className="h-4 w-4" />
      </Link>
      <Link
        href={`/admin/restaurants/${row.id as string}/edit`}
        className="p-2 text-info hover:bg-info/10 rounded"
        title="Edit"
        aria-label="Edit restaurant"
      >
        <Edit className="h-4 w-4" />
      </Link>
      <button
        onClick={() => handleSuspend(row.id as string, !!(row.is_active))}
        className={`p-2 rounded ${
          row.is_active
            ? 'text-warning hover:bg-warning/10'
            : 'text-success hover:bg-success/10'
        }`}
        title={row.is_active ? 'Suspend' : 'Activate'}
        aria-label={row.is_active ? 'Suspend restaurant' : 'Activate restaurant'}
      >
        {row.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
      </button>
      <button
        onClick={() => handleDelete(row.id as string, row.name as string)}
        className="p-2 text-destructive hover:bg-destructive/10 rounded"
        title="Delete"
        aria-label="Delete restaurant"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurants"
        description={`Manage all restaurants on the platform. Total: ${allRestaurants.length}`}
        actions={
          <Button asChild>
            <Link href="/admin/restaurants/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Restaurant
            </Link>
          </Button>
        }
      />

      <SearchFilterBar
        search={{
          value: searchQuery,
          onChange: (v) => setSearchQuery(v),
          placeholder: 'Search restaurants...',
        }}
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: (v) => setStatusFilter(v),
            options: [
              { label: 'All Status', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Suspended', value: 'suspended' },
            ],
          },
        ]}
        actions={
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showFlaggedOnly}
              onChange={(e) => setShowFlaggedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-input text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-foreground">Show flagged only</span>
          </label>
        }
      />

      <DataTable<RestaurantEntry>
        data={paginatedItems}
        columns={columns}
        actions={renderActions}
        loading={loading}
        emptyState={
          <EmptyState
            icon={Store}
            title="No restaurants found"
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No restaurants have been added yet.'
            }
            action={
              !searchQuery && statusFilter === 'all'
                ? { label: 'Add Restaurant', href: '/admin/restaurants/new' }
                : undefined
            }
          />
        }
        pagination={{ page, totalPages, onPageChange: setPage }}
      />

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
