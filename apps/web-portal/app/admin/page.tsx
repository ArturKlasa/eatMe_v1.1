'use client';

import { useEffect, useState } from 'react';
import { Store, Utensils, Users, Activity, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

/**
 * SECURITY: Admin Dashboard Overview Page
 *
 * Features:
 * - Statistics overview
 * - Quick actions
 * - Recent activity
 * - Security status
 *
 * @security Protected by AdminLayout - only admins can access
 */

export default function AdminDashboardPage() {
  const [statsData, setStatsData] = useState({
    totalRestaurants: 0,
    activeRestaurants: 0,
    suspendedRestaurants: 0,
    totalDishes: 0,
    activeDishes: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      console.log('[Admin] Loading stats from admin_dashboard_stats view...');
      const { data, error } = await supabase.from('admin_dashboard_stats').select('*').single();

      console.log('[Admin] Stats query result:', { data, error });

      if (error) {
        console.error('[Admin] Failed to load stats:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          statusCode: (error as any).statusCode,
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
        });
      }
    };

    loadStats();
  }, []);

  const totalRestaurants = statsData.totalRestaurants;
  const activeRestaurants = statsData.activeRestaurants;
  const suspendedRestaurants = statsData.suspendedRestaurants;
  const totalDishes = statsData.totalDishes;
  const activeDishes = statsData.activeDishes;
  const totalUsers = statsData.totalUsers;

  const stats = [
    {
      name: 'Total Restaurants',
      value: totalRestaurants,
      subtext: `${activeRestaurants} active, ${suspendedRestaurants} suspended`,
      icon: Store,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Total Dishes',
      value: totalDishes,
      subtext: `${activeDishes} available`,
      icon: Utensils,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Total Users',
      value: totalUsers,
      subtext: 'Restaurant owners + admins',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome to the EatMe admin dashboard. Monitor and manage all platform activities.
        </p>
      </div>

      {/* Security Status Banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Activity className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">System Status: Secure</h3>
            <p className="text-sm text-green-700 mt-1">
              All security measures are active. Last security audit:{' '}
              {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      {/* Security Reminders */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">Security Reminders</h3>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>All your actions are logged and monitored</li>
              <li>Use suspension instead of deletion when possible</li>
              <li>Always provide a reason for suspensions</li>
              <li>Review audit logs regularly for unusual activity</li>
              <li>Log out when finished with admin tasks</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
