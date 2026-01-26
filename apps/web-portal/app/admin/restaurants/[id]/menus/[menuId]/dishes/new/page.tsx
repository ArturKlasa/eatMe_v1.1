'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, Utensils } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { DIETARY_TAGS, ALLERGENS, SPICE_LEVELS } from '@/lib/constants';

export default function NewDishPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;
  const menuId = params.menuId as string;

  const [restaurantName, setRestaurantName] = useState('');
  const [menuName, setMenuName] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    is_available: true,
    spice_level: 0,
    dietary_tags: [] as string[],
    allergens: [] as string[],
    ingredients: [] as string[],
    calories: '',
    image_url: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .single();

      if (restaurant) {
        setRestaurantName(restaurant.name);
      }

      const { data: menu } = await supabase.from('menus').select('name').eq('id', menuId).single();

      if (menu) {
        setMenuName(menu.name);
      }
    };

    fetchData();
  }, [restaurantId, menuId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const price = parseFloat(formData.price);
      if (isNaN(price) || price < 0) {
        toast.error('Please enter a valid price');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('dishes').insert({
        menu_id: menuId,
        name: formData.name,
        description: formData.description || null,
        price: price,
        is_available: formData.is_available,
        spice_level: formData.spice_level,
        dietary_tags: formData.dietary_tags,
        allergens: formData.allergens,
        ingredients: formData.ingredients,
        calories: formData.calories ? parseInt(formData.calories) : null,
        image_url: formData.image_url || null,
      });

      if (error) {
        console.error('[Admin] Error creating dish:', error);
        toast.error('Failed to create dish');
        setLoading(false);
        return;
      }

      toast.success('Dish created successfully!');
      router.push(`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes`);
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes`}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Dish</h1>
          <p className="mt-2 text-gray-600">
            {restaurantName} → {menuName}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-orange-600" />
              <CardTitle>Dish Information</CardTitle>
            </div>
            <CardDescription>
              Add a new dish to {menuName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Dish Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Margherita Pizza, Caesar Salad"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Describe the dish, ingredients, preparation..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  placeholder="12.99"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calories">Calories</Label>
                <Input
                  id="calories"
                  type="number"
                  min="0"
                  value={formData.calories}
                  onChange={e => setFormData({ ...formData, calories: e.target.value })}
                  placeholder="450"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image URL</Label>
              <Input
                id="image"
                type="url"
                value={formData.image_url}
                onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="available"
                checked={formData.is_available}
                onCheckedChange={checked => setFormData({ ...formData, is_available: checked as boolean })}
              />
              <Label htmlFor="available" className="cursor-pointer">
                ✅ Available (visible to customers)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dietary Information</CardTitle>
            <CardDescription>Help customers find dishes that match their dietary needs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Dietary Tags</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DIETARY_TAGS.map(tag => {
                  const isSelected = formData.dietary_tags.includes(tag.value);
                  return (
                    <div
                      key={tag.value}
                      onClick={() => {
                        const current = formData.dietary_tags;
                        setFormData({
                          ...formData,
                          dietary_tags: isSelected
                            ? current.filter(t => t !== tag.value)
                            : [...current, tag.value],
                        });
                      }}
                      className={`p-3 border rounded-lg cursor-pointer text-center transition-all ${
                        isSelected
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50'
                      }`}
                    >
                      <p className="text-sm font-medium">{tag.icon} {tag.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Spice Level</Label>
              <div className="flex gap-2">
                {SPICE_LEVELS.map(level => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, spice_level: level.value })}
                    className={`flex-1 p-3 border rounded-lg transition-all ${
                      formData.spice_level === level.value
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-400'
                    }`}
                  >
                    <div className="text-lg">{level.icon}</div>
                    <p className="text-xs mt-1">{level.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Allergens</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALLERGENS.map(allergen => {
                  const isSelected = formData.allergens.includes(allergen.value);
                  return (
                    <div
                      key={allergen.value}
                      onClick={() => {
                        const current = formData.allergens;
                        setFormData({
                          ...formData,
                          allergens: isSelected
                            ? current.filter(a => a !== allergen.value)
                            : [...current, allergen.value],
                        });
                      }}
                      className={`p-2 border rounded-lg cursor-pointer text-center transition-all ${
                        isSelected
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-red-400 hover:bg-red-50/50'
                      }`}
                    >
                      <p className="text-xs font-medium">{allergen.icon} {allergen.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Dish
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes`}>
              Cancel
            </Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
