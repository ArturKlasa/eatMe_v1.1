'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DishCard } from '@/components/forms/DishCard';
import { DishFormDialog } from '@/components/forms/DishFormDialog';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { toast } from 'sonner';
import { Dish, Menu } from '@/types/restaurant';
import { menuSchema } from '@/lib/validation';
import { loadRestaurantData, saveRestaurantData } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { addDishIngredients } from '@/lib/ingredients';
import {
  PlusCircle,
  ArrowLeft,
  ArrowRight,
  MoreVertical,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function MenuPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isDishDialogOpen, setIsDishDialogOpen] = useState(false);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuName, setMenuName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load menus from database
  useEffect(() => {
    const loadMenus = async () => {
      if (!user?.id) return;

      try {
        // First, try to load from database
        const { data: restaurant, error } = await supabase
          .from('restaurants')
          .select('id, menus(*, dishes(*))')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading menus:', error);
        }

        if (restaurant?.menus && restaurant.menus.length > 0) {
          // Load from database
          const dbMenus = restaurant.menus.map(menu => ({
            ...menu,
            dishes: menu.dishes || [],
          }));
          setMenus(dbMenus);
          setActiveMenuId(dbMenus[0].id);
        } else {
          // Fall back to localStorage drafts
          const savedData = loadRestaurantData(user.id);
          if (savedData?.menus && savedData.menus.length > 0) {
            setMenus(savedData.menus);
            setActiveMenuId(savedData.menus[0].id);
          } else if (savedData?.dishes && savedData.dishes.length > 0) {
            // Migrate old single-menu format
            const defaultMenu = {
              id: crypto.randomUUID(),
              name: 'Main Menu',
              description: '',
              is_active: true,
              display_order: 1,
              dishes: savedData.dishes,
            };
            setMenus([defaultMenu]);
            setActiveMenuId(defaultMenu.id);
          } else {
            // Create default menu
            const defaultMenu = {
              id: crypto.randomUUID(),
              name: 'Main Menu',
              description: '',
              is_active: true,
              display_order: 1,
              dishes: [],
            };
            setMenus([defaultMenu]);
            setActiveMenuId(defaultMenu.id);
          }
        }
      } catch (err) {
        console.error('Failed to load menus:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMenus();
  }, [user?.id]);

  // Auto-save menus to localStorage only when editing (not from database)
  useEffect(() => {
    if (menus.length > 0 && user?.id && !loading) {
      // Only save drafts, not database data
      const savedData = loadRestaurantData(user.id);
      const allDishes = menus.flatMap(menu => menu.dishes);
      saveRestaurantData(user.id, {
        basicInfo: savedData?.basicInfo || {},
        operations: savedData?.operations || {},
        menus,
        dishes: allDishes,
        currentStep: 3,
      });
    }
  }, [menus, user?.id, loading]);

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

  const handleSaveMenu = () => {
    if (!menuName.trim()) {
      toast.error('Please enter a menu name');
      return;
    }

    if (editingMenu) {
      // Update existing menu
      const updatedMenus = menus.map(m => (m.id === editingMenu.id ? { ...m, name: menuName } : m));
      setMenus(updatedMenus);
      toast.success('Menu updated successfully!');
    } else {
      // Create new menu
      const newMenu: Menu = {
        id: crypto.randomUUID(),
        name: menuName,
        description: '',
        is_active: true,
        display_order: menus.length + 1,
        dishes: [],
      };
      setMenus([...menus, newMenu]);
      setActiveMenuId(newMenu.id);
      toast.success('Menu created successfully!');
    }

    setIsMenuDialogOpen(false);
    setMenuName('');
    setEditingMenu(null);
  };

  const handleDeleteMenu = (menuId: string) => {
    if (menus.length === 1) {
      toast.error('You must have at least one menu');
      return;
    }

    const updatedMenus = menus.filter(m => m.id !== menuId);
    setMenus(updatedMenus);

    if (activeMenuId === menuId) {
      setActiveMenuId(updatedMenus[0]?.id || null);
    }

    toast.success('Menu deleted');
  };

  const handleAddDish = (dish: Dish) => {
    if (!activeMenuId) return;

    const newDish = {
      ...dish,
      id: dish.id || crypto.randomUUID(),
      menu_id: activeMenuId,
    };

    const updatedMenus = menus.map(menu =>
      menu.id === activeMenuId ? { ...menu, dishes: [...menu.dishes, newDish] } : menu
    );

    setMenus(updatedMenus);
    toast.success('Dish added successfully!');
    setIsDishDialogOpen(false);
  };

  const handleEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setIsDishDialogOpen(true);
  };

  const handleUpdateDish = (updatedDish: Dish) => {
    if (!activeMenuId) return;

    const updatedMenus = menus.map(menu =>
      menu.id === activeMenuId
        ? {
            ...menu,
            dishes: menu.dishes.map(d => (d.id === updatedDish.id ? updatedDish : d)),
          }
        : menu
    );

    setMenus(updatedMenus);
    toast.success('Dish updated successfully!');
    setEditingDish(null);
    setIsDishDialogOpen(false);
  };

  const handleDeleteDish = (dishId: string) => {
    if (!activeMenuId) return;

    const updatedMenus = menus.map(menu =>
      menu.id === activeMenuId
        ? { ...menu, dishes: menu.dishes.filter(d => d.id !== dishId) }
        : menu
    );

    setMenus(updatedMenus);
    toast.success('Dish deleted');
  };

  const handleDuplicateDish = (dish: Dish) => {
    if (!activeMenuId) return;

    const duplicatedDish = {
      ...dish,
      id: crypto.randomUUID(),
      name: `${dish.name} (Copy)`,
      menu_id: activeMenuId,
    };

    const updatedMenus = menus.map(menu =>
      menu.id === activeMenuId ? { ...menu, dishes: [...menu.dishes, duplicatedDish] } : menu
    );

    setMenus(updatedMenus);
    toast.success('Dish duplicated!');
  };

  const handleNext = async () => {
    // Save menus and dishes to database directly
    const allDishes = menus.flatMap(menu => menu.dishes);

    if (allDishes.length === 0) {
      toast.error('Please add at least one dish before saving');
      return;
    }

    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    setSaving(true);

    try {
      // Get restaurant ID
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (restaurantError || !restaurant) {
        toast.error('Restaurant not found. Please create restaurant information first.');
        setSaving(false);
        return;
      }

      // Delete existing menus and dishes (will cascade delete dishes)
      await supabase.from('menus').delete().eq('restaurant_id', restaurant.id);

      // Insert new menus and dishes
      for (const menu of menus) {
        const { data: insertedMenu, error: menuError } = await supabase
          .from('menus')
          .insert({
            restaurant_id: restaurant.id,
            name: menu.name,
            description: menu.description || null,
            is_active: menu.is_active !== undefined ? menu.is_active : true,
            display_order: menu.display_order || 1,
          })
          .select()
          .single();

        if (menuError) {
          console.error('Menu insert error:', menuError);
          throw new Error(`Failed to save menu "${menu.name}"`);
        }

        // Insert dishes for this menu
        if (menu.dishes && menu.dishes.length > 0) {
          const dishesPayload = menu.dishes.map((dish: any) => ({
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
            throw new Error(`Failed to save dishes for menu "${menu.name}"`);
          }

          // ✨ NEW: Link ingredients to dishes
          if (insertedDishes) {
            for (let i = 0; i < insertedDishes.length; i++) {
              const dish = menu.dishes[i];
              const insertedDish = insertedDishes[i];

              // Check if dish has selectedIngredients from the new autocomplete
              if (
                (dish as any).selectedIngredients &&
                (dish as any).selectedIngredients.length > 0
              ) {
                const { error: ingredientsError } = await addDishIngredients(
                  insertedDish.id,
                  (dish as any).selectedIngredients.map((ing: any) => ({
                    ingredient_id: ing.id,
                    quantity: ing.quantity || null,
                  }))
                );

                if (ingredientsError) {
                  console.error(
                    'Failed to link ingredients for dish:',
                    dish.name,
                    ingredientsError
                  );
                  // Don't throw error - ingredients are optional, dish creation succeeded
                }
              }
            }
          }
        }
      }

      // Clear localStorage draft after successful save
      localStorage.removeItem(`eatme_draft_${user.id}`);

      toast.success('Menus and dishes saved successfully!');
      router.push('/');
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save menus');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  const handleOpenDishDialog = () => {
    setEditingDish(null);
    setIsDishDialogOpen(true);
  };

  const totalDishes = menus.reduce((sum, menu) => sum + menu.dishes.length, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading menus...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Menu Management</h1>
          <p className="text-gray-600">
            Organize your menu items into different menus. Create multiple menus for different meal
            times or seasons.
          </p>
        </div>

        {/* Menus Tabs */}
        <Card className="mb-6">
          <Tabs value={activeMenuId || undefined} onValueChange={setActiveMenuId}>
            <div className="flex items-center justify-between p-4 border-b">
              <TabsList>
                {menus.map(menu => (
                  <TabsTrigger key={menu.id} value={menu.id}>
                    {menu.name}
                    {menu.dishes.length > 0 && (
                      <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                        {menu.dishes.length}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <Button variant="outline" size="sm" onClick={handleAddMenu}>
                <Plus className="h-4 w-4 mr-2" />
                Add Menu
              </Button>
            </div>

            {menus.map(menu => (
              <TabsContent key={menu.id} value={menu.id} className="p-6">
                {/* Menu Header */}
                <div className="flex items-start justify-between mb-6">
                  <h2 className="text-xl font-semibold">{menu.name}</h2>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditMenu(menu)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Menu
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteMenu(menu.id)}
                        disabled={menus.length === 1}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Menu
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <Button onClick={handleOpenDishDialog} size="lg">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Add Dish
                  </Button>
                </div>

                {/* Dishes List */}
                {menu.dishes.length === 0 ? (
                  <Card className="p-12 text-center border-dashed">
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-gray-100 rounded-full p-6">
                        <PlusCircle className="h-12 w-12 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">No dishes in this menu yet</h3>
                        <p className="text-gray-600 mb-4">Start adding dishes to {menu.name}</p>
                        <Button onClick={handleOpenDishDialog}>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Your First Dish
                        </Button>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {menu.dishes.map(dish => (
                      <DishCard
                        key={dish.id}
                        dish={dish}
                        onEdit={handleEditDish}
                        onDelete={handleDeleteDish}
                        onDuplicate={handleDuplicateDish}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={handleBack} disabled={saving}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button onClick={handleNext} disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                Save & Return to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Dialog for Add/Edit Dish */}
        <DishFormDialog
          isOpen={isDishDialogOpen}
          onClose={() => {
            setIsDishDialogOpen(false);
            setEditingDish(null);
          }}
          onSubmit={editingDish ? handleUpdateDish : handleAddDish}
          dish={editingDish}
        />

        {/* Dialog for Add/Edit Menu */}
        <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMenu ? 'Edit Menu' : 'Create New Menu'}</DialogTitle>
              <DialogDescription>
                {editingMenu ? 'Update the menu name' : 'Create a new menu to organize your dishes'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="menu-name">Menu Name *</Label>
                <Input
                  id="menu-name"
                  placeholder="e.g., Lunch Menu, Dinner Menu, Drinks"
                  value={menuName}
                  onChange={e => setMenuName(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Menu Name will be visible to customers</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMenuDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMenu}>{editingMenu ? 'Update' : 'Create'} Menu</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function MenuPage() {
  return (
    <ProtectedRoute>
      <MenuPageContent />
    </ProtectedRoute>
  );
}
