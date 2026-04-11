'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Utensils,
  ChefHat,
  MapPin,
  CheckCircle2,
  ArrowRight,
  LogOut,
  Clock,
  Check,
} from 'lucide-react';
import { loadRestaurantData } from '@/lib/storage';
import { FormProgress } from '@/types/restaurant';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getRestaurantSummary, type DashboardRestaurant } from '@/lib/restaurantService';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

function DashboardContent() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [userRestaurant, setUserRestaurant] = useState<DashboardRestaurant | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user's restaurant from database
  useEffect(() => {
    const loadUserRestaurant = async () => {
      if (!user) return;
      try {
        setUserRestaurant(await getRestaurantSummary(user.id));
      } catch (err) {
        console.error('[Dashboard] Failed to load restaurant:', err);
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
      (acc, menu) =>
        acc + (menu.menu_categories?.reduce((a, cat) => a + (cat.dishes?.length ?? 0), 0) ?? 0),
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
      color: 'text-brand-primary',
      bgColor: 'bg-brand-primary/5',
      status: userRestaurant ? 'completed' : savedData?.basicInfo ? 'in-progress' : 'not-started',
      badge: userRestaurant ? 'Active' : null,
    },
    {
      title: 'Menu Management',
      description: 'Add, edit, and organize your menus, dishes with prices and descriptions',
      icon: Utensils,
      href: '/menu/manage',
      color: 'text-success',
      bgColor: 'bg-success/10',
      status: totalDishes > 0 ? 'completed' : 'not-started',
      badge: dishBadgeText,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-6">
          <PageHeader
            title="EatMe Restaurant Portal"
            description={`Welcome, ${user?.user_metadata?.restaurant_name || user?.email}`}
            actions={
              <div className="flex items-center gap-4">
                {savedData?.lastSaved && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Draft saved locally
                  </Badge>
                )}
                {userRestaurant && !savedData?.lastSaved && (
                  <Badge variant="secondary" className="flex items-center gap-1 bg-success/10 text-success border-success/20">
                    <Check className="h-3 w-3" />
                    Saved
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            }
          />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Loading state */}
        {loading && <LoadingSkeleton variant="card" count={2} />}

        {/* New user welcome */}
        {!loading && !userRestaurant && !savedData && (
          <Card className="mb-8 bg-gradient-to-r from-brand-primary/5 to-amber-50 border-brand-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                👋 Welcome to EatMe Restaurant Portal!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground mb-4">
                You haven&apos;t created a restaurant yet. Get started by adding your restaurant
                information and menu.
              </p>
              <Link href="/onboard/basic-info">
                <Button className="bg-brand-primary hover:bg-brand-primary/90">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Create Your Restaurant
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Existing restaurant or draft progress */}
        {!loading && (userRestaurant || savedData) && (
          <Card className="mb-8 bg-linear-to-r from-brand-primary/5 to-red-50 border-brand-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-brand-primary" />
                {userRestaurant ? 'Your Restaurant' : 'Your Progress'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userRestaurant ? (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{userRestaurant.name}</h3>
                  <p className="text-sm text-muted-foreground">{userRestaurant.address}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-success">{totalMenus}</div>
                      <p className="text-sm text-muted-foreground">Menu{totalMenus !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-info">{totalDishes}</div>
                      <p className="text-sm text-muted-foreground">Dish{totalDishes !== 1 ? 'es' : ''}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {userRestaurant.cuisine_types?.length || 0}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Cuisine{userRestaurant.cuisine_types?.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-brand-primary">
                      {savedData?.basicInfo ? '✓' : '○'}
                    </div>
                    <p className="text-sm text-muted-foreground">Basic Info</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-info">
                      {savedData?.operations ? '✓' : '○'}
                    </div>
                    <p className="text-sm text-muted-foreground">Operations</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {savedData?.dishes?.length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Menu Items</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {savedData?.currentStep || 0}/4
                    </div>
                    <p className="text-sm text-muted-foreground">Steps Complete</p>
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
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{item.description}</CardDescription>
                      {item.status === 'completed' && (
                        <div className="flex items-center gap-1 text-success text-sm mt-2">
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

        {/* Help Section */}
        <Card className="mt-8 border-info/20 bg-info/10">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground mb-2">
              Have questions about setting up your restaurant profile?
            </p>
            <a
              href="mailto:partners@eatme.app"
              className="text-sm text-info hover:underline font-medium"
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
