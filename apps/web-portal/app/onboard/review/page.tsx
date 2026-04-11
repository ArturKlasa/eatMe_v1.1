'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { loadRestaurantData, clearRestaurantData } from '@/lib/storage';
import type { FormProgress, Menu, RestaurantType } from '@eatme/shared';
import type { Location as AppLocation } from '@eatme/shared';
import { basicInfoSchema } from '@eatme/shared';
import { SPICE_LEVELS } from '@eatme/shared';
import { ArrowLeft, CheckCircle2, Edit, Loader2, UtensilsCrossed, BookOpen, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getRestaurantFull, submitRestaurantProfile } from '@/lib/restaurantService';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

function ReviewPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restaurantData, setRestaurantData] = useState<FormProgress | null>(null);
  const [loading, setLoading] = useState(true);

  // Load restaurant data from database or localStorage
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      try {
        const fromDb = await getRestaurantFull(user.id);
        setRestaurantData(fromDb ?? loadRestaurantData(user.id));
      } catch {
        setRestaurantData(loadRestaurantData(user.id));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.id]);

  useEffect(() => {
    if (
      !loading &&
      (!restaurantData || !restaurantData.menus || restaurantData.menus.length === 0)
    ) {
      toast.error('No restaurant data found. Please add at least one menu first.');
      router.push('/onboard/menu');
    }
  }, [restaurantData, loading, router]);

  const handleSubmit = async () => {
    if (!restaurantData || !restaurantData.basicInfo) {
      toast.error('Missing restaurant data');
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate required fields via Zod schema (UI-level check before hitting the DB)
      const validation = basicInfoSchema.safeParse(restaurantData.basicInfo);
      if (!validation.success) {
        toast.error(validation.error.issues[0]?.message ?? 'Please check your restaurant details');
        setIsSubmitting(false);
        return;
      }

      await submitRestaurantProfile(restaurantData, user!.id);

      const action = restaurantData.restaurant_id ? 'updated' : 'created';
      toast.success(
        `Restaurant ${action} successfully with ${restaurantData.menus?.length || 0} menus!`
      );

      if (user?.id) clearRestaurantData(user.id);
      router.push('/');
    } catch (error) {
      console.error('[Review] Submission error:', error);
      toast.error(
        error instanceof Error
          ? `Failed to submit: ${error.message}`
          : 'Failed to submit restaurant information. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  const handleEditMenu = () => {
    router.push('/onboard/menu');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-brand-primary/5 to-red-50 p-6">
        <div className="max-w-4xl mx-auto">
          <LoadingSkeleton variant="page" />
        </div>
      </div>
    );
  }

  if (!restaurantData || !restaurantData.menus || restaurantData.menus.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No data found. Redirecting...</p>
      </div>
    );
  }

  const totalDishes = restaurantData.menus?.reduce((sum, menu) => sum + menu.dishes.length, 0) || 0;
  const totalMenus = restaurantData.menus?.length || 0;
  const cuisineCount = restaurantData.basicInfo?.cuisines?.length || 0;

  return (
    <div className="min-h-screen bg-linear-to-br from-brand-primary/5 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Review & Submit</h1>
          <p className="text-muted-foreground">
            Please review all information before submitting your restaurant profile
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <BookOpen className="h-4 w-4 text-brand-primary" />
              <span className="text-2xl font-bold text-brand-primary">{totalMenus}</span>
            </div>
            <p className="text-sm text-muted-foreground">{totalMenus === 1 ? 'Menu' : 'Menus'}</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <UtensilsCrossed className="h-4 w-4 text-info" />
              <span className="text-2xl font-bold text-info">{totalDishes}</span>
            </div>
            <p className="text-sm text-muted-foreground">{totalDishes === 1 ? 'Dish' : 'Dishes'}</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Badge variant="secondary" className="text-lg font-bold px-2 py-0">{cuisineCount}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{cuisineCount === 1 ? 'Cuisine' : 'Cuisines'}</p>
          </Card>
        </div>

        {/* Restaurant Information Section */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {restaurantData.basicInfo && <CheckCircle2 className="h-5 w-5 text-success" />}
              <CardTitle className="text-2xl">Restaurant Information</CardTitle>
            </div>
            <Button size="sm" onClick={handleBack}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {restaurantData.basicInfo ? (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Restaurant Name</p>
                  <p className="text-lg font-semibold">
                    {restaurantData.basicInfo.name || 'Not specified'}
                  </p>
                </div>
                <Separator />
                {restaurantData.basicInfo.restaurant_type && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Restaurant Type</p>
                      <p className="text-foreground capitalize">
                        {restaurantData.basicInfo.restaurant_type.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <Separator />
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="text-foreground">
                      {restaurantData.basicInfo.phone || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Website</p>
                    <p className="text-foreground">
                      {restaurantData.basicInfo.website || 'Not specified'}
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Country</p>
                  <p className="text-foreground">
                    {restaurantData.basicInfo.country || 'Not specified'}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="text-foreground">
                    {restaurantData.basicInfo.address || 'Not specified'}
                  </p>
                </div>
                {restaurantData.basicInfo.cuisines &&
                  restaurantData.basicInfo.cuisines.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Cuisines</p>
                        <div className="flex flex-wrap gap-2">
                          {restaurantData.basicInfo.cuisines.map(cuisine => (
                            <Badge key={cuisine} variant="secondary">
                              {cuisine}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                {restaurantData.operations?.payment_methods && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Payment Methods</p>
                      <p className="text-foreground">
                        {restaurantData.operations.payment_methods === 'cash_and_card' &&
                          '💵💳 Cash & Card'}
                        {restaurantData.operations.payment_methods === 'cash_only' &&
                          '💵 Cash Only'}
                        {restaurantData.operations.payment_methods === 'card_only' &&
                          '💳 Card Only'}
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-muted-foreground italic">Restaurant information not yet added</p>
            )}
          </CardContent>
        </Card>

        {/* Menu Section */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {totalDishes > 0 && <CheckCircle2 className="h-5 w-5 text-success" />}
              <div>
                <CardTitle className="text-2xl">Menu</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalMenus} {totalMenus === 1 ? 'menu' : 'menus'} • {totalDishes}{' '}
                  {totalDishes === 1 ? 'dish' : 'dishes'}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleEditMenu}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </CardHeader>
          <CardContent>
            {restaurantData.menus && restaurantData.menus.length > 0 ? (
              <div className="space-y-6">
                {restaurantData.menus.map((menu: Menu) => (
                  <div key={menu.id}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">{menu.name}</h3>
                      <Badge variant="outline">{menu.dishes.length} dishes</Badge>
                    </div>

                    {menu.dishes.length > 0 ? (
                      <div className="space-y-3">
                        {menu.dishes.map((dish, idx) => (
                          <div key={dish.id || idx} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{dish.name}</h4>
                                  <span className="text-success font-bold">
                                    ${dish.price.toFixed(2)}
                                  </span>
                                  {dish.calories && (
                                    <Badge variant="outline" className="text-xs">
                                      {dish.calories} cal
                                    </Badge>
                                  )}
                                </div>
                                {dish.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{dish.description}</p>
                                )}
                              </div>
                            </div>

                            {(dish.selectedIngredients?.length ?? 0) > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-medium text-muted-foreground">Ingredients:</p>
                                <p className="text-sm text-foreground">
                                  {dish.selectedIngredients!.map(i => i.display_name).join(', ')}
                                </p>
                              </div>
                            )}

                            {(dish.dietary_tags.length > 0 ||
                              dish.allergens.length > 0 ||
                              (dish.spice_level != null && dish.spice_level !== 'none')) && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {dish.spice_level != null && dish.spice_level !== 'none' && (
                                  <Badge
                                    variant="outline"
                                    className="bg-destructive/10 text-destructive border-destructive/20"
                                  >
                                    {SPICE_LEVELS.find(l => l.value === dish.spice_level)?.icon}
                                  </Badge>
                                )}
                                {dish.dietary_tags.map(tag => (
                                  <Badge
                                    key={tag}
                                    className="bg-success/10 text-success capitalize"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {dish.allergens.map(allergen => (
                                  <Badge
                                    key={allergen}
                                    className="bg-brand-primary/10 text-brand-primary capitalize"
                                  >
                                    <AlertTriangle className="h-3 w-3 inline-block mr-0.5" />{allergen}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic text-sm">No dishes in this menu</p>
                    )}

                    {menu !== restaurantData.menus[restaurantData.menus.length - 1] && (
                      <Separator className="mt-6" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">No menus added yet</p>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button
            onClick={handleSubmit}
            size="lg"
            className="bg-success hover:bg-success"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Submit Restaurant Profile
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <ProtectedRoute>
      <ReviewPageContent />
    </ProtectedRoute>
  );
}
