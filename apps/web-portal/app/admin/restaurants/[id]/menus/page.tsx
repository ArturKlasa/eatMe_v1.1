'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, MoreVertical, Pencil, Trash2, Loader2, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DishCard } from '@/components/forms/DishCard';
import { DishFormDialog } from '@/components/forms/DishFormDialog';

interface Menu {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  dishes?: Dish[];
}

interface Dish {
  id: string;
  menu_id: string;
  name: string;
  description?: string;
  price: number;
  calories?: number;
  spice_level?: number;
  image_url?: string;
  is_available: boolean;
  dietary_tags: string[];
  allergens: string[];
  ingredients: string[];
}

export default function RestaurantMenusPage() {
  const params = useParams();
  const restaurantId = params.id as string;

  const [restaurantName, setRestaurantName] = useState('');
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Menu dialog state
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuName, setMenuName] = useState('');

  // Dish dialog state
  const [isDishDialogOpen, setIsDishDialogOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

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

      // Fetch menus with dishes
      const { data: menusData, error } = await supabase
        .from('menus')
        .select('*, dishes(*)')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('[Admin] Error fetching menus:', error);
        toast.error('Failed to load menus');
      } else {
        const formattedMenus = (menusData || []).map(menu => ({
          ...menu,
          dishes: menu.dishes || [],
        }));
        setMenus(formattedMenus);
        if (formattedMenus.length > 0 && !activeMenuId) {
          setActiveMenuId(formattedMenus[0].id);
        }
      }
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMenu = () => {
    setEditingMenu(null);
    setMenuName('');
    setIsMenuDialogOpen(true);
  };

  const handleEditMenu = (menu: Menu) => {
    setEditingMenu(menu);
    setMenuName(menu.name);
    setIsMenuDialogOpen(true);
  };

  const handleSaveMenu = async () => {
    if (!menuName.trim()) {
      toast.error('Please enter a menu name');
      return;
    }

    try {
      if (editingMenu) {
        // Update existing menu
        const { error } = await supabase
          .from('menus')
          .update({ name: menuName })
          .eq('id', editingMenu.id);

        if (error) {
          console.error('[Admin] Error updating menu:', error);
          toast.error('Failed to update menu');
          return;
        }

        toast.success('Menu updated successfully');
      } else {
        // Create new menu
        const maxOrder = menus.length > 0 ? Math.max(...menus.map(m => m.display_order)) : 0;

        const { error } = await supabase.from('menus').insert({
          restaurant_id: restaurantId,
          name: menuName,
          description: null,
          display_order: maxOrder + 1,
          is_active: true,
        });

        if (error) {
          console.error('[Admin] Error creating menu:', error);
          toast.error('Failed to create menu');
          return;
        }

        toast.success('Menu created successfully');
      }

      setIsMenuDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleDeleteMenu = async (menuId: string, menuName: string) => {
    const confirmed = window.confirm(
      `Delete menu "${menuName}"?\n\nThis will also delete all dishes in this menu. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('menus').delete().eq('id', menuId);

      if (error) {
        console.error('[Admin] Error deleting menu:', error);
        toast.error('Failed to delete menu');
        return;
      }

      toast.success('Menu deleted successfully');

      // Update local state
      const newMenus = menus.filter(m => m.id !== menuId);
      setMenus(newMenus);
      if (activeMenuId === menuId && newMenus.length > 0) {
        setActiveMenuId(newMenus[0].id);
      }
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleAddDish = () => {
    setEditingDish(null);
    setIsDishDialogOpen(true);
  };

  const handleEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setIsDishDialogOpen(true);
  };

  const handleSaveDish = async (dishData: Partial<Dish>) => {
    if (!activeMenuId) return;

    try {
      if (editingDish) {
        // Update existing dish
        const { error } = await supabase
          .from('dishes')
          .update({
            name: dishData.name,
            description: dishData.description || null,
            price: dishData.price,
            calories: dishData.calories || null,
            spice_level: dishData.spice_level || null,
            image_url: dishData.image_url || null,
            is_available: dishData.is_available ?? true,
            dietary_tags: dishData.dietary_tags || [],
            allergens: dishData.allergens || [],
            ingredients: dishData.ingredients || [],
          })
          .eq('id', editingDish.id);

        if (error) {
          console.error('[Admin] Error updating dish:', error);
          toast.error('Failed to update dish');
          return;
        }

        toast.success('Dish updated successfully');
      } else {
        // Create new dish
        const { error } = await supabase.from('dishes').insert({
          restaurant_id: restaurantId,
          menu_id: activeMenuId,
          name: dishData.name!,
          description: dishData.description || null,
          price: dishData.price!,
          calories: dishData.calories || null,
          spice_level: dishData.spice_level || null,
          image_url: dishData.image_url || null,
          is_available: dishData.is_available ?? true,
          dietary_tags: dishData.dietary_tags || [],
          allergens: dishData.allergens || [],
          ingredients: dishData.ingredients || [],
        });

        if (error) {
          console.error('[Admin] Error creating dish:', error);
          toast.error('Failed to create dish');
          return;
        }

        toast.success('Dish created successfully');
      }

      setIsDishDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleDeleteDish = async (dishId: string, dishName: string) => {
    const confirmed = window.confirm(`Delete dish "${dishName}"? This action cannot be undone.`);

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('dishes').delete().eq('id', dishId);

      if (error) {
        console.error('[Admin] Error deleting dish:', error);
        toast.error('Failed to delete dish');
        return;
      }

      toast.success('Dish deleted successfully');
      fetchData();
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleDuplicateDish = async (dish: Dish) => {
    try {
      const { error } = await supabase.from('dishes').insert({
        restaurant_id: restaurantId,
        menu_id: dish.menu_id,
        name: `${dish.name} (Copy)`,
        description: dish.description || null,
        price: dish.price,
        calories: dish.calories || null,
        spice_level: dish.spice_level || null,
        image_url: dish.image_url || null,
        is_available: dish.is_available,
        dietary_tags: dish.dietary_tags || [],
        allergens: dish.allergens || [],
        ingredients: dish.ingredients || [],
      });

      if (error) {
        console.error('[Admin] Error duplicating dish:', error);
        toast.error('Failed to duplicate dish');
        return;
      }

      toast.success('Dish duplicated successfully');
      fetchData();
    } catch (error) {
      console.error('[Admin] Unexpected error:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const activeMenu = menus.find(m => m.id === activeMenuId);
  const activeDishes = activeMenu?.dishes || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/restaurants">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Restaurants
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
              <p className="text-gray-600 mt-2">{restaurantName}</p>
            </div>
            <Button onClick={handleAddMenu} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Menu
            </Button>
          </div>
        </div>

        {menus.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <PlusCircle className="h-16 w-16 text-gray-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">No menus yet</h3>
                <p className="text-gray-600 mt-1">Get started by creating your first menu</p>
              </div>
              <Button onClick={handleAddMenu} className="bg-orange-600 hover:bg-orange-700">
                <Plus className="mr-2 h-4 w-4" />
                Create Menu
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <Tabs value={activeMenuId || undefined} onValueChange={setActiveMenuId}>
              <div className="flex items-center justify-between mb-4">
                <TabsList className="flex-1">
                  {menus.map(menu => (
                    <TabsTrigger key={menu.id} value={menu.id} className="relative">
                      {menu.name}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <span className="ml-2 p-1 hover:bg-gray-200 rounded cursor-pointer inline-block">
                            <MoreVertical className="h-3 w-3" />
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleEditMenu(menu)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Menu
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteMenu(menu.id, menu.name)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Menu
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {menus.map(menu => (
                <TabsContent key={menu.id} value={menu.id} className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">
                      {activeDishes.length} {activeDishes.length === 1 ? 'Dish' : 'Dishes'}
                    </h2>
                    <Button onClick={handleAddDish} className="bg-orange-600 hover:bg-orange-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Dish
                    </Button>
                  </div>

                  {activeDishes.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                      <PlusCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900">No dishes yet</h3>
                      <p className="text-gray-600 mt-1 mb-4">
                        Add dishes to this menu to get started
                      </p>
                      <Button onClick={handleAddDish} className="bg-orange-600 hover:bg-orange-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Dish
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeDishes.map(dish => (
                        <DishCard
                          key={dish.id}
                          dish={dish}
                          onEdit={() => handleEditDish(dish)}
                          onDelete={() => handleDeleteDish(dish.id, dish.name)}
                          onDuplicate={() => handleDuplicateDish(dish)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        )}

        {/* Menu Dialog */}
        <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMenu ? 'Edit Menu' : 'Create New Menu'}</DialogTitle>
              <DialogDescription>
                {editingMenu ? 'Update menu details' : 'Enter a name for your new menu'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="menu-name">Menu Name</Label>
                <Input
                  id="menu-name"
                  value={menuName}
                  onChange={e => setMenuName(e.target.value)}
                  placeholder="e.g., Lunch Menu, Dinner Menu"
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMenuDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMenu} className="bg-orange-600 hover:bg-orange-700">
                {editingMenu ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dish Dialog */}
        <DishFormDialog
          isOpen={isDishDialogOpen}
          onClose={() => setIsDishDialogOpen(false)}
          onSubmit={handleSaveDish}
          dish={editingDish}
        />
      </div>
    </div>
  );
}
