'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Store } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/supabase';
import { RestaurantTable } from '@/components/admin/RestaurantTable';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';
import { computeWarningFlags } from '@/lib/import-service';
import type { WarningFlag } from '@/lib/import-types';

type RestaurantWithCounts = Restaurant & { menuCount: number; dishCount: number };

const PAGE_SIZES = [10, 25, 50] as const;

export default function AdminRestaurantsPage() {
  const [allRestaurants, setAllRestaurants] = useState<RestaurantWithCounts[]>([]);
  const [warningsMap, setWarningsMap] = useState<Map<string, WarningFlag[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

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

      // Fetch dish counts for all restaurants
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

      const mapped = rows.map((restaurant) => ({
        ...restaurant,
        menuCount: 0,
        dishCount: dishCountMap.get(restaurant.id) ?? 0,
      }));

      // Compute warning flags per restaurant
      const warnings = new Map<string, WarningFlag[]>();
      for (const restaurant of mapped) {
        warnings.set(restaurant.id, computeWarningFlags(restaurant, restaurant.dishCount));
      }

      setAllRestaurants(mapped);
      setWarningsMap(warnings);
      setLoading(false);
    };

    loadRestaurants();
  }, []);

  // Filter
  const filtered = allRestaurants.filter(r => {
    const matchesSearch =
      !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && r.is_active) ||
      (statusFilter === 'suspended' && !r.is_active);
    const matchesFlagged =
      !showFlaggedOnly || (warningsMap.get(r.id) ?? []).length > 0;
    return matchesSearch && matchesStatus && matchesFlagged;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRestaurants = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
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

      {/* Filters and Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search restaurants..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as 'all' | 'active' | 'suspended'); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Restaurant Table */}
      {loading ? (
        <LoadingSkeleton variant="table" count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No restaurants found"
          description={searchQuery || statusFilter !== 'all'
            ? 'Try adjusting your search or filter criteria.'
            : 'No restaurants have been added yet.'}
          action={
            !searchQuery && statusFilter === 'all'
              ? { label: 'Add Restaurant', href: '/admin/restaurants/new' }
              : undefined
          }
        />
      ) : (
        <>
          <RestaurantTable
            restaurants={paginatedRestaurants}
            warnings={warningsMap}
            showFlaggedOnly={showFlaggedOnly}
            onToggleFlaggedOnly={(v) => { setShowFlaggedOnly(v); setPage(1); }}
          />

          {/* Pagination */}
          {filtered.length > pageSize && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {PAGE_SIZES.map(size => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="ml-2">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of{' '}
                  {filtered.length}
                </span>
              </div>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      aria-disabled={safePage <= 1}
                      className={safePage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .map((p, idx, arr) => (
                      <PaginationItem key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <PaginationLink
                          onClick={() => setPage(p)}
                          isActive={p === safePage}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      aria-disabled={safePage >= totalPages}
                      className={safePage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
}
