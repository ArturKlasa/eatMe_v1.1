'use client';

import { useEffect, useState } from 'react';
import { Store, Utensils, Users, Activity, Shield, Download } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

type ImportJob = {
  id: string;
  source: string;
  total_inserted: number | null;
  total_fetched: number | null;
  created_at: string | null;
};

export default function AdminDashboardPage() {
  const [statsData, setStatsData] = useState<{
    totalRestaurants: number;
    activeRestaurants: number;
    suspendedRestaurants: number;
    totalDishes: number;
    activeDishes: number;
    totalUsers: number;
    importedRestaurants: number;
  } | null>(null);
  const [recentImports, setRecentImports] = useState<ImportJob[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      const [{ data, error }, { count: importedCount }, { data: importJobs }] = await Promise.all([
        supabase.from('admin_dashboard_stats').select('*').single(),
        supabase
          .from('restaurants')
          .select('id', { count: 'exact', head: true })
          .not('google_place_id', 'is', null),
        supabase
          .from('restaurant_import_jobs')
          .select('id, source, total_inserted, total_fetched, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (error) {
        console.error('[Admin] Failed to load stats:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return;
      }

      if (data) {
        setStatsData({
          totalRestaurants: data.total_restaurants || 0,
          activeRestaurants: data.active_restaurants || 0,
          suspendedRestaurants: data.suspended_restaurants || 0,
          totalDishes: data.total_dishes || 0,
          activeDishes: data.active_dishes || 0,
          totalUsers: (data.restaurant_owners || 0) + (data.admin_users || 0),
          importedRestaurants: importedCount || 0,
        });
      }

      if (importJobs) {
        setRecentImports(importJobs);
      }
    };

    loadStats();
  }, []);

  const stats = statsData
    ? [
        {
          name: 'Total Restaurants',
          value: statsData.totalRestaurants,
          subtext: `${statsData.activeRestaurants} active, ${statsData.suspendedRestaurants} suspended`,
          icon: Store,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
        },
        {
          name: 'Total Dishes',
          value: statsData.totalDishes,
          subtext: `${statsData.activeDishes} available`,
          icon: Utensils,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
        },
        {
          name: 'Total Users',
          value: statsData.totalUsers,
          subtext: 'Restaurant owners + admins',
          icon: Users,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
        },
        {
          name: 'Imported Restaurants',
          value: statsData.importedRestaurants,
          subtext: 'Via Google Places or CSV',
          icon: Download,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
        },
      ]
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin Dashboard"
        description="Monitor and manage all platform activities."
      />

      {/* Statistics Grid */}
      {!stats ? (
        <LoadingSkeleton variant="stats" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.name}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className={`${stat.bgColor} p-3 rounded-lg`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">{stat.name}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/admin/restaurants"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Store className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-900">Manage Restaurants</p>
              <p className="text-sm text-gray-600">View, edit, or suspend restaurants</p>
            </div>
          </Link>

          <Link
            href="/admin/audit"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Activity className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium text-gray-900">View Audit Logs</p>
              <p className="text-sm text-gray-600">Review all admin actions</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Imports */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Imports</h2>
          <Link
            href="/admin/restaurants/import"
            className="text-sm text-orange-600 hover:underline"
          >
            Go to Import
          </Link>
        </div>
        {recentImports.length === 0 ? (
          <p className="text-sm text-gray-500">No imports yet. Use the Import page to bulk-add restaurants.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentImports.map(job => (
              <div key={job.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {job.source === 'google_places' ? 'Google Places' : 'CSV Upload'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {job.created_at
                      ? new Date(job.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{job.total_inserted ?? 0} inserted</p>
                  <p className="text-xs text-gray-500">of {job.total_fetched ?? 0} fetched</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Single-line security reminder */}
      <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <Shield className="h-4 w-4 text-yellow-600 flex-shrink-0" />
        <span>All admin actions are logged and monitored for security purposes.</span>
      </div>
    </div>
  );
}
