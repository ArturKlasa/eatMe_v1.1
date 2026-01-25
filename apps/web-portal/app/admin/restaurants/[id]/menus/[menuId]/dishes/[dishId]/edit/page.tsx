'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function EditDishPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;
  const menuId = params.menuId as string;
  const dishId = params.dishId as string;

  const [restaurantName, setRestaurantName] = useState('');
  const [menuName, setMenuName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
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
      try {
        // Fetch restaurant name
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', restaurantId)
          .single();

        if (restaurant) {
          setRestaurantName(restaurant.name);
        }

        // Fetch menu name
        const { data: menu } = await supabase
          .from('menus')
          .select('name')
          .eq('id', menuId)
          .single();

        if (menu) {
          setMenuName(menu.name);
        }

        // Fetch dish data
        const { data: dish, error } = await supabase
          .from('dishes')
          .select('*')
          .eq('id', dishId)
          .single();

        if (error) {
          console.error('[Admin] Error fetching dish:', error);
          toast.error('Failed to load dish');
          router.push(`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes`);
          return;
        }

        if (dish) {
          setFormData({
            name: dish.name || '',
            description: dish.description || '',
            price: dish.price?.toString() || '',
            is_available: dish.is_available !== false,
            spice_level: dish.spice_level || 0,
            dietary_tags: dish.dietary_tags || [],
            allergens: dish.allergens || [],
            ingredients: dish.ingredients || [],
            calories: dish.calories?.toString() || '',
            image_url: dish.image_url || '',
          });
        }
      } catch (error) {
        console.error('[Admin] Unexpected error:', error);
        toast.error('An unexpected error occurred');
        router.push(`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes`);
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [restaurantId, menuId, dishId, router]);

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

      const { error } = await supabase
        .from('dishes')
        .update({
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
        })
        .eq('id', dishId);

      if (error) {
        console.error('[Admin] Error updating dish:', error);
        toast.error('Failed to update dish');
        setLoading(false);
        return;
      }

      toast.success('Dish updated successfully!');
      router.push(`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes`);
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Edit Dish</h1>
          <p className="mt-2 text-gray-600">
            {restaurantName} → {menuName}
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-lg p-6 space-y-6"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dish Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., Margherita Pizza, Caesar Salad"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={3}
              placeholder="Describe the dish, ingredients, preparation..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="12.99"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Tags</label>
            <select
              multiple
              value={formData.dietary_tags}
              onChange={e =>
                setFormData({
                  ...formData,
                  dietary_tags: Array.from(e.target.selectedOptions, option => option.value),
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              size={6}
            >
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="gluten-free">Gluten-Free</option>
              <option value="dairy-free">Dairy-Free</option>
              <option value="nut-free">Nut-Free</option>
              <option value="low-carb">Low-Carb</option>
              <option value="keto">Keto</option>
              <option value="paleo">Paleo</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spice Level (0-4)
            </label>
            <input
              type="number"
              min="0"
              max="4"
              value={formData.spice_level}
              onChange={e => setFormData({ ...formData, spice_level: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">0 = No spice, 4 = Very spicy</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
            <input
              type="number"
              min="0"
              value={formData.calories}
              onChange={e => setFormData({ ...formData, calories: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., 450"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              type="url"
              value={formData.image_url}
              onChange={e => setFormData({ ...formData, image_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_available}
                onChange={e => setFormData({ ...formData, is_available: e.target.checked })}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Available (visible to customers)</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>

          <Link
            href={`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes`}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
