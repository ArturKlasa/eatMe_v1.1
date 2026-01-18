'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Utensils,
  Settings,
  Download,
  ChefHat,
  MapPin,
  CheckCircle2,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { loadRestaurantData } from '@/lib/storage';
import { FormProgress } from '@/types/restaurant';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

function DashboardContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [userRestaurant, setUserRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load user's restaurant from database
  useEffect(() => {
    const loadUserRestaurant = async () => {
      if (!user) return;

      try {
        console.log('[Dashboard] Loading restaurant for user:', user.id);

        const { data, error } = await supabase
          .from('restaurants')
          .select('*, menus(*, dishes(*))')
          .eq('owner_id', user.id)
          .maybeSingle();

        console.log('[Dashboard] Query result:', { data, error });

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading restaurant:', error);
          console.error('Error details:', JSON.stringify(error));
        } else {
          console.log('[Dashboard] Restaurant loaded:', data);
          setUserRestaurant(data);
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUserRestaurant();
  }, [user]);

  // Load from localStorage for draft work ONLY if no restaurant exists
  const savedData = useMemo<FormProgress | null>(() => {
    if (typeof window !== 'undefined' && user?.id && !userRestaurant && !loading) {
      const data = loadRestaurantData(user.id);
      return data;
    }
    return null;
  }, [user, userRestaurant, loading]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    router.push('/auth/login');
  };

  // Calculate total dishes and menus from database or draft
  const totalDishes =
    userRestaurant?.menus?.reduce(
      (acc: number, menu: any) => acc + (menu.dishes?.length || 0),
      0
    ) ||
    savedData?.dishes?.length ||
    0;
  const totalMenus = userRestaurant?.menus?.length || savedData?.menus?.length || 0;
  const dishBadgeText =
    totalMenus > 0
      ? `${totalMenus} ${totalMenus === 1 ? 'menu' : 'menus'}, ${totalDishes} ${totalDishes === 1 ? 'dish' : 'dishes'}`
      : totalDishes > 0
        ? `${totalDishes} ${totalDishes === 1 ? 'dish' : 'dishes'}`
        : null;

  const navigationItems = [
    {
      title: 'Restaurant Information',
      description: 'Update your restaurant details, location, hours, and contact info',
      icon: MapPin,
      href: userRestaurant ? '/restaurant/edit' : '/onboard/basic-info',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      status: userRestaurant ? 'completed' : savedData?.basicInfo ? 'in-progress' : 'not-started',
      badge: userRestaurant ? 'Active' : null,
    },
    {
      title: 'Menu Management',
      description: 'Add, edit, and organize your menus, dishes with prices and descriptions',
      icon: Utensils,
      href: '/menu/manage',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      status: totalDishes > 0 ? 'completed' : 'not-started',
      badge: dishBadgeText,
    },
  ];

  const quickActions = [
    {
      title: 'Download Template',
      description: 'Get CSV template for bulk menu import',
      icon: Download,
      action: 'download-template',
    },
    {
      title: 'Settings',
      description: 'Configure portal preferences',
      icon: Settings,
      action: 'settings',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 rounded-lg p-2">
                <ChefHat className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">EatMe Restaurant Portal</h1>
                <p className="text-sm text-gray-600">
                  Welcome, {user?.user_metadata?.restaurant_name || user?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {savedData?.lastSaved && (
                <Badge variant="secondary">
                  Last saved: {new Date(savedData.lastSaved).toLocaleString()}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your restaurant...</p>
          </div>
        )}

        {/* New user welcome */}
        {!loading && !userRestaurant && !savedData && (
          <Card className="mb-8 bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                👋 Welcome to EatMe Restaurant Portal!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-4">
                You haven&apos;t created a restaurant yet. Get started by adding your restaurant
                information and menu.
              </p>
              <Link href="/onboard/basic-info">
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Create Your Restaurant
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Existing restaurant or draft progress */}
        {!loading && (userRestaurant || savedData) && (
          <Card className="mb-8 bg-linear-to-r from-orange-50 to-red-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-orange-500" />
                {userRestaurant ? 'Your Restaurant' : 'Your Progress'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userRestaurant ? (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{userRestaurant.name}</h3>
                  <p className="text-sm text-gray-600">{userRestaurant.address}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{totalMenus}</div>
                      <p className="text-sm text-gray-600">Menu{totalMenus !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{totalDishes}</div>
                      <p className="text-sm text-gray-600">Dish{totalDishes !== 1 ? 'es' : ''}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {userRestaurant.cuisine_types?.length || 0}
                      </div>
                      <p className="text-sm text-gray-600">
                        Cuisine{userRestaurant.cuisine_types?.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {savedData?.basicInfo ? '✓' : '○'}
                    </div>
                    <p className="text-sm text-gray-600">Basic Info</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {savedData?.operations ? '✓' : '○'}
                    </div>
                    <p className="text-sm text-gray-600">Operations</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {savedData?.dishes?.length || 0}
                    </div>
                    <p className="text-sm text-gray-600">Menu Items</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {savedData?.currentStep || 0}/4
                    </div>
                    <p className="text-sm text-gray-600">Steps Complete</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Navigation - always show */}
        {!loading && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Manage Your Restaurant</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {navigationItems.map(item => (
                <Link key={item.title} href={item.href}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`${item.bgColor} p-3 rounded-lg`}>
                            <item.icon className={`h-6 w-6 ${item.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{item.title}</CardTitle>
                            {item.badge && (
                              <Badge variant="secondary" className="mt-1">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{item.description}</CardDescription>
                      {item.status === 'completed' && (
                        <div className="flex items-center gap-1 text-green-600 text-sm mt-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Completed
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {!loading && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {quickActions.map(action => (
                <Card key={action.title} className="hover:bg-gray-50 cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <action.icon className="h-5 w-5 text-gray-600" />
                      <div>
                        <CardTitle className="text-base">{action.title}</CardTitle>
                        <CardDescription className="text-sm">{action.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Help Section */}
        <Card className="mt-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-2">
              Have questions about setting up your restaurant profile?
            </p>
            <a
              href="mailto:partners@eatme.app"
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Contact Support →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
