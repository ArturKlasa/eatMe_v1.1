'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  spice_level: number | null;
  dietary_tags: string[];
  allergens: string[];
  created_at: string;
}

export default function MenuDishesPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;
  const menuId = params.menuId as string;

  const [restaurantName, setRestaurantName] = useState('');
  const [menuName, setMenuName] = useState('');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

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

        // Fetch dishes
        const { data: dishesData, error } = await supabase
          .from('dishes')
          .select('*')
          .eq('menu_id', menuId)
          .order('name', { ascending: true });

        if (error) {
          console.error('[Admin] Error fetching dishes:', error);
          toast.error('Failed to load dishes');
        } else {
          setDishes(dishesData || []);
        }
      } catch (error) {
        console.error('[Admin] Unexpected error:', error);
        toast.error('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [restaurantId, menuId]);

  const handleDelete = async (dishId: string, dishName: string) => {
    const confirmed = window.confirm(`Delete dish "${dishName}"?\n\nThis action cannot be undone.`);

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('dishes').delete().eq('id', dishId);

      if (error) {
        console.error('[Admin] Error deleting dish:', error);
        toast.error('Failed to delete dish');
        return;
      }

      toast.success('Dish deleted successfully');
      setDishes(prev => prev.filter(d => d.id !== dishId));
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/restaurants/${restaurantId}/menus`}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dishes</h1>
            <p className="mt-2 text-gray-600">
              {restaurantName} → {menuName}
            </p>
          </div>
        </div>

        <Link
          href={`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes/new`}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="h-5 w-5" />
          Add Dish
        </Link>
      </div>

      {/* Dishes List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {dishes.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">No dishes yet</p>
            <Link
              href={`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Plus className="h-5 w-5" />
              Add First Dish
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Dish Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Tags
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dishes.map(dish => (
                <tr key={dish.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{dish.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                    {dish.description || <span className="text-gray-400">No description</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    ${dish.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {dish.dietary_tags && dish.dietary_tags.length > 0 ? (
                        dish.dietary_tags.map(tag => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">No tags</span>
                      )}
                      {dish.spice_level && dish.spice_level > 0 && (
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                          🌶️ {dish.spice_level}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        dish.is_available
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {dish.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes/${dish.id}/edit`}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(dish.id, dish.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
