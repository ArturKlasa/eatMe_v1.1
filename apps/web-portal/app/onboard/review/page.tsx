'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { loadRestaurantData } from '@/lib/storage';
import { Menu } from '@/types/restaurant';
import { ArrowLeft, CheckCircle2, Edit } from 'lucide-react';
import { toast } from 'sonner';

export default function ReviewPage() {
  const router = useRouter();

  const restaurantData = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return loadRestaurantData();
  }, []);

  useEffect(() => {
    if (!restaurantData || !restaurantData.menus || restaurantData.menus.length === 0) {
      toast.error('No restaurant data found. Please add at least one menu first.');
      router.push('/');
    }
  }, [restaurantData, router]);

  const handleSubmit = () => {
    // TODO: Submit to backend API
    toast.success('Restaurant information submitted successfully!');
    console.log('Submitting restaurant data:', restaurantData);
    // After successful submission, could redirect to a success page or dashboard
    // router.push('/success');
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

  if (!restaurantData || !restaurantData.menus || restaurantData.menus.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
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
          <Button onClick={handleSubmit} size="lg" className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="mr-2 h-5 w-5" />
            Submit Restaurant Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
