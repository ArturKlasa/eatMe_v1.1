'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { loadRestaurantData } from '@/lib/storage';
import { Menu } from '@/types/restaurant';
import { ArrowLeft, CheckCircle2, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  supabase,
  formatLocationForSupabase,
  formatOperatingHours,
  RestaurantInsert,
} from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

function ReviewPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load restaurant data from database or localStorage
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;

      try {
        // Try to load from database first
        const { data: restaurant, error } = await supabase
          .from('restaurants')
          .select('*, menus(*, dishes(*))')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading restaurant:', error);
        }

        if (restaurant) {
          setRestaurantData({
            restaurant_id: restaurant.id,
            basicInfo: {
              name: restaurant.name,
              restaurant_type: restaurant.restaurant_type,
              description: restaurant.description,
              country: restaurant.country,
              address: restaurant.address,
              location: restaurant.location,
              phone: restaurant.phone,
              website: restaurant.website,
              cuisines: restaurant.cuisine_types || [],
            },
            operations: {
              operating_hours: restaurant.operating_hours,
              delivery_available: restaurant.delivery_available,
              takeout_available: restaurant.takeout_available,
              dine_in_available: restaurant.dine_in_available,
              service_speed: restaurant.service_speed,
              accepts_reservations: restaurant.accepts_reservations,
            },
            menus: restaurant.menus || [],
            dishes: restaurant.menus?.flatMap((m: any) => m.dishes || []) || [],
          });
        } else {
          const savedData = loadRestaurantData(user.id);
          setRestaurantData(savedData);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        // Fall back to localStorage
        const savedData = loadRestaurantData(user.id);
        setRestaurantData(savedData);
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
      console.log('[Review] Validation failed - redirecting to menu page');
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
      // Validate required fields
      const basicInfo = restaurantData.basicInfo;
      if (!basicInfo.name || !basicInfo.address) {
        toast.error('Restaurant name and address are required');
        setIsSubmitting(false);
        return;
      }

      if (!basicInfo.location?.lat || !basicInfo.location?.lng) {
        toast.error('Location coordinates are required. Please select location on the map.');
        setIsSubmitting(false);
        return;
      }

      if (!basicInfo.cuisines || basicInfo.cuisines.length === 0) {
        toast.error('At least one cuisine type is required');
        setIsSubmitting(false);
        return;
      }

      // Transform data for Supabase
      const restaurantPayload: RestaurantInsert & { owner_id?: string } = {
        // Link to authenticated user
        owner_id: user?.id,

        // Required fields
        name: basicInfo.name,
        location: formatLocationForSupabase(basicInfo.location.lat, basicInfo.location.lng),
        address: basicInfo.address,
        cuisine_types: basicInfo.cuisines,

        // Optional basic info
        restaurant_type: basicInfo.restaurant_type,
        country_code: basicInfo.country,
        city: basicInfo.city,
        neighbourhood: basicInfo.neighbourhood,
        state: basicInfo.state,
        postal_code: basicInfo.postal_code,

        // Contact
        phone: basicInfo.phone,
        website: basicInfo.website,

        // Operating hours (filter out closed days)
        open_hours: restaurantData.operations?.operating_hours
          ? formatOperatingHours(
              restaurantData.operations.operating_hours as Record<
                string,
                { open: string; close: string; closed: boolean }
              >
            )
          : {},

        // Service options
        delivery_available: restaurantData.operations?.delivery_available ?? true,
        takeout_available: restaurantData.operations?.takeout_available ?? true,
        dine_in_available: restaurantData.operations?.dine_in_available ?? true,
        accepts_reservations: restaurantData.operations?.accepts_reservations ?? false,
        service_speed: restaurantData.operations?.service_speed as
          | 'fast-food'
          | 'regular'
          | undefined,

        // Optional fields
        description: basicInfo.description,
      };

      // Step 1: Check if we're updating an existing restaurant
      const existingRestaurantId = restaurantData.restaurant_id;
      let restaurant;

      if (existingRestaurantId) {
        // Update existing restaurant
        const { data, error: restaurantError } = await supabase
          .from('restaurants')
          .update(restaurantPayload)
          .eq('id', existingRestaurantId)
          .select()
          .single();

        if (restaurantError) {
          console.error('Supabase restaurant update error:', restaurantError);
          throw new Error(restaurantError.message);
        }

        restaurant = data;
        console.log('Restaurant updated successfully:', restaurant);

        // Delete existing menus and dishes (will be recreated)
        await supabase.from('menus').delete().eq('restaurant_id', existingRestaurantId);
        // Dishes will be automatically deleted due to CASCADE DELETE
      } else {
        // Create new restaurant
        const { data, error: restaurantError } = await supabase
          .from('restaurants')
          .insert(restaurantPayload)
          .select()
          .single();

        if (restaurantError) {
          console.error('Supabase restaurant error:', restaurantError);
          throw new Error(restaurantError.message);
        }

        restaurant = data;
        console.log('Restaurant created successfully:', restaurant);
      }

      // Step 2: Submit menus and dishes if they exist
      if (restaurantData.menus && restaurantData.menus.length > 0) {
        for (const menu of restaurantData.menus) {
          // Insert menu
          const { data: insertedMenu, error: menuError } = await supabase
            .from('menus')
            .insert({
              restaurant_id: restaurant.id,
              name: menu.name,
              description: menu.description,
              category: menu.category || null,
              display_order: menu.display_order || 0,
              is_active: menu.is_active !== undefined ? menu.is_active : true,
            })
            .select()
            .single();

          if (menuError) {
            console.error('Menu insert error:', menuError);
            throw new Error(`Failed to insert menu "${menu.name}": ${menuError.message}`);
          }

          console.log('Menu submitted successfully:', insertedMenu);

          // Insert dishes for this menu
          if (menu.dishes && menu.dishes.length > 0) {
            const dishesPayload = menu.dishes.map(dish => ({
              restaurant_id: restaurant.id,
              menu_id: insertedMenu.id,
              name: dish.name,
              description: dish.description || null,
              price: dish.price,
              dietary_tags: dish.dietary_tags || [],
              allergens: dish.allergens || [],
              ingredients: dish.ingredients || [],
              calories: dish.calories || null,
              spice_level: dish.spice_level || null,
              image_url: dish.photo_url || null,
              is_available: dish.is_available !== undefined ? dish.is_available : true,
            }));

            const { data: insertedDishes, error: dishesError } = await supabase
              .from('dishes')
              .insert(dishesPayload)
              .select();

            if (dishesError) {
              console.error('Dishes insert error:', dishesError);
              throw new Error(
                `Failed to insert dishes for menu "${menu.name}": ${dishesError.message}`
              );
            }

            console.log(`${insertedDishes.length} dishes submitted for menu "${menu.name}"`);
          }
        }
      }

      // Success!
      const action = existingRestaurantId ? 'updated' : 'created';
      toast.success(
        `Restaurant ${action} successfully with ${restaurantData.menus?.length || 0} menus!`
      );

      // Clear user-specific draft data after successful submission
      if (user?.id) {
        localStorage.removeItem(`eatme_draft_${user.id}`);
      }

      // Redirect to dashboard
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Submission error:', error);
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

  const handleEditRestaurantInfo = () => {
    router.push('/');
  };

  const handleEditMenu = () => {
    router.push('/onboard/menu');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading restaurant data...</p>
        </div>
      </div>
    );
  }

  if (!restaurantData || !restaurantData.menus || restaurantData.menus.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No data found. Redirecting...</p>
      </div>
    );
  }

  const totalDishes = restaurantData.menus?.reduce((sum, menu) => sum + menu.dishes.length, 0) || 0;

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Review & Submit</h1>
          <p className="text-gray-600">
            Please review all information before submitting your restaurant profile
          </p>
        </div>

        {/* Restaurant Information Section */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl">Restaurant Information</CardTitle>
            <Button variant="outline" size="sm" onClick={handleEditRestaurantInfo}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {restaurantData.basicInfo ? (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-500">Restaurant Name</p>
                  <p className="text-lg font-semibold">
                    {restaurantData.basicInfo.name || 'Not specified'}
                  </p>
                </div>
                <Separator />
                {restaurantData.basicInfo.restaurant_type && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Restaurant Type</p>
                      <p className="text-gray-700 capitalize">
                        {restaurantData.basicInfo.restaurant_type.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <Separator />
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
                    <p className="text-gray-700">
                      {restaurantData.basicInfo.phone || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Website</p>
                    <p className="text-gray-700">
                      {restaurantData.basicInfo.website || 'Not specified'}
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-gray-500">Country</p>
                  <p className="text-gray-700">
                    {restaurantData.basicInfo.country || 'Not specified'}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p className="text-gray-700">
                    {restaurantData.basicInfo.address || 'Not specified'}
                  </p>
                </div>
                {restaurantData.basicInfo.cuisines &&
                  restaurantData.basicInfo.cuisines.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Cuisines</p>
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
              </>
            ) : (
              <p className="text-gray-500 italic">Restaurant information not yet added</p>
            )}
          </CardContent>
        </Card>

        {/* Menu Section */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Menu</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {restaurantData.menus?.length || 0}{' '}
                {restaurantData.menus?.length === 1 ? 'menu' : 'menus'} • {totalDishes}{' '}
                {totalDishes === 1 ? 'dish' : 'dishes'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleEditMenu}>
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
                                  <span className="text-green-600 font-bold">
                                    ${dish.price.toFixed(2)}
                                  </span>
                                  {dish.calories && (
                                    <Badge variant="outline" className="text-xs">
                                      {dish.calories} cal
                                    </Badge>
                                  )}
                                </div>
                                {dish.description && (
                                  <p className="text-sm text-gray-600 mt-1">{dish.description}</p>
                                )}
                              </div>
                            </div>

                            {dish.ingredients.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-medium text-gray-500">Ingredients:</p>
                                <p className="text-sm text-gray-700">
                                  {dish.ingredients.join(', ')}
                                </p>
                              </div>
                            )}

                            {(dish.dietary_tags.length > 0 ||
                              dish.allergens.length > 0 ||
                              (dish.spice_level !== undefined && dish.spice_level > 0)) && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {dish.spice_level !== undefined && dish.spice_level > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="bg-red-50 text-red-700 border-red-200"
                                  >
                                    {dish.spice_level === 0 ? '🥛 No spicy' : '🌶️ Spicy'}
                                  </Badge>
                                )}
                                {dish.dietary_tags.map(tag => (
                                  <Badge
                                    key={tag}
                                    className="bg-green-100 text-green-800 capitalize"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {dish.allergens.map(allergen => (
                                  <Badge
                                    key={allergen}
                                    className="bg-orange-100 text-orange-800 capitalize"
                                  >
                                    ⚠️ {allergen}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic text-sm">No dishes in this menu</p>
                    )}

                    {menu !== restaurantData.menus[restaurantData.menus.length - 1] && (
                      <Separator className="mt-6" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No menus added yet</p>
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
            className="bg-green-600 hover:bg-green-700"
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
