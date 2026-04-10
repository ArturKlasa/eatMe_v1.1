'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Menu, MenuCategory, Dish } from '@/lib/supabase';
import type { Dish as FormDish } from '@/types/restaurant';
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { DishFormDialog } from '@/components/forms/DishFormDialog';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface MenuWithCategories extends Menu {
  categories?: MenuCategoryWithDishes[];
}

interface MenuCategoryWithDishes extends MenuCategory {
  dishes?: Dish[];
}

/** Map a DB Dish row to the shape expected by DishFormDialog. */
function dbDishToFormDish(d: Dish): Partial<FormDish> & { id?: string } {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? undefined,
    price: d.price,
    calories: d.calories ?? undefined,
    dietary_tags: (d.dietary_tags as string[]) ?? [],
    allergens: (d.allergens as string[]) ?? [],
    spice_level: d.spice_level as FormDish['spice_level'],
    photo_url: d.image_url ?? undefined,
    is_available: d.is_available ?? true,
    dish_category_id: d.dish_category_id,
    description_visibility: d.description_visibility as FormDish['description_visibility'],
    ingredients_visibility: d.ingredients_visibility as FormDish['ingredients_visibility'],
    dish_kind: d.dish_kind as FormDish['dish_kind'],
    display_price_prefix: d.display_price_prefix as FormDish['display_price_prefix'],
  };
}

export default function RestaurantMenusPage() {
  const params = useParams();
  const restaurantId = params.id as string;

  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantCuisine, setRestaurantCuisine] = useState<string>('');
  const [menus, setMenus] = useState<MenuWithCategories[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // Menu dialog state
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuFormData, setMenuFormData] = useState({ name: '', description: '' });

  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [selectedMenuForCategory, setSelectedMenuForCategory] = useState<string>('');
  const [categoryFormData, setCategoryFormData] = useState({ name: '', type: '', description: '' });

  // Dish dialog state
  const [isDishDialogOpen, setIsDishDialogOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [selectedCategoryForDish, setSelectedCategoryForDish] = useState<string>('');
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch restaurant name
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('name, cuisine_types')
        .eq('id', restaurantId)
        .single();

      if (restaurantError) {
        console.error('[Admin] Restaurant fetch error:', restaurantError);
        throw new Error(`Failed to fetch restaurant: ${restaurantError.message}`);
      }

      if (restaurant) {
        setRestaurantName(restaurant.name);
        // Set first cuisine if available
        if (restaurant.cuisine_types && restaurant.cuisine_types.length > 0) {
          setRestaurantCuisine(restaurant.cuisine_types[0]);
        }
      }

      // Fetch menus
      const { data: menusData, error: menusError } = await supabase
        .from('menus')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true });

      if (menusError) {
        console.error('[Admin] Menus fetch error:', menusError);
        throw new Error(`Failed to fetch menus: ${menusError.message}`);
      }

      // Fetch categories for each menu
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true });

      if (categoriesError) {
        console.error('[Admin] Categories fetch error:', categoriesError);
        throw new Error(`Failed to fetch categories: ${categoriesError.message}`);
      }

      // Fetch all dishes
      const { data: dishesData, error: dishesError } = await supabase
        .from('dishes')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name', { ascending: true });

      if (dishesError) {
        console.error('[Admin] Dishes fetch error:', dishesError);
        throw new Error(`Failed to fetch dishes: ${dishesError.message}`);
      }

      console.log('[Admin] Fetched data:', {
        menus: menusData?.length || 0,
        categories: categoriesData?.length || 0,
        dishes: dishesData?.length || 0,
      });

      // Build hierarchy
      const menusWithCategories: MenuWithCategories[] = (menusData || []).map(menu => ({
        ...menu,
        categories: (categoriesData || [])
          .filter(cat => cat.menu_id === menu.id)
          .map(cat => ({
            ...cat,
            dishes: (dishesData || []).filter(dish => dish.menu_category_id === cat.id),
          })),
      }));

      setMenus(menusWithCategories);
    } catch (error: unknown) {
      console.error('[Admin] Error fetching data:', error);
      if (error instanceof Error) {
        console.error('[Admin] Error details:', { message: error.message });
        toast.error(error.message || 'Failed to load menus');
      } else {
        toast.error('Failed to load menus');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMenuExpanded = (menuId: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuId)) {
      newExpanded.delete(menuId);
    } else {
      newExpanded.add(menuId);
    }
    setExpandedMenus(newExpanded);
  };

  // Menu CRUD operations
  const handleAddMenu = () => {
    setEditingMenu(null);
    setMenuFormData({ name: '', description: '' });
    setIsMenuDialogOpen(true);
  };

  const handleEditMenu = (menu: Menu) => {
    setEditingMenu(menu);
    setMenuFormData({ name: menu.name, description: menu.description || '' });
    setIsMenuDialogOpen(true);
  };

  const handleSaveMenu = async () => {
    try {
      if (editingMenu) {
        // Update
        const { error } = await supabase
          .from('menus')
          .update({ name: menuFormData.name, description: menuFormData.description })
          .eq('id', editingMenu.id);

        if (error) throw error;
        toast.success('Menu updated');
      } else {
        // Create
        const { error } = await supabase.from('menus').insert({
          restaurant_id: restaurantId,
          name: menuFormData.name,
          description: menuFormData.description,
          display_order: menus.length,
          is_active: true,
        });

        if (error) throw error;
        toast.success('Menu added');
      }

      setIsMenuDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      console.error('[Admin] Error saving menu:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to save menu: ' + message);
    }
  };

  const handleDeleteMenu = (menuId: string, menuName: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Menu',
      description: `Delete "${menuName}"? This will delete all categories and dishes in this menu. This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        try {
          const { error } = await supabase.from('menus').delete().eq('id', menuId);
          if (error) throw error;
          toast.success('Menu deleted');
          fetchData();
        } catch (error: unknown) {
          console.error('[Admin] Error deleting menu:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          toast.error('Failed to delete: ' + message);
        }
      },
    });
  };

  // Category CRUD operations
  const handleAddCategory = (menuId: string) => {
    setEditingCategory(null);
    setSelectedMenuForCategory(menuId);
    setCategoryFormData({ name: '', type: '', description: '' });
    setIsCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: MenuCategory) => {
    setEditingCategory(category);
    setSelectedMenuForCategory(category.menu_id ?? '');
    setCategoryFormData({
      name: category.name,
      type: category.type || '',
      description: category.description || '',
    });
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    try {
      if (editingCategory) {
        // Update
        const { error } = await supabase
          .from('menu_categories')
          .update({
            name: categoryFormData.name,
            type: categoryFormData.type,
            description: categoryFormData.description,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Category updated');
      } else {
        // Create
        const menu = menus.find(m => m.id === selectedMenuForCategory);
        const categoryCount = menu?.categories?.length || 0;

        const { error } = await supabase.from('menu_categories').insert({
          restaurant_id: restaurantId,
          menu_id: selectedMenuForCategory,
          name: categoryFormData.name,
          type: categoryFormData.type,
          description: categoryFormData.description,
          display_order: categoryCount,
        });

        if (error) throw error;
        toast.success('Category added');
      }

      setIsCategoryDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      console.error('[Admin] Error saving category:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to save category: ' + message);
    }
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Category',
      description: `Delete "${categoryName}"? This will delete all dishes in this category. This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        try {
          const { error } = await supabase.from('menu_categories').delete().eq('id', categoryId);
          if (error) throw error;
          toast.success('Category deleted');
          fetchData();
        } catch (error: unknown) {
          console.error('[Admin] Error deleting category:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          toast.error('Failed to delete: ' + message);
        }
      },
    });
  };

  // Dish operations
  const handleAddDish = (categoryId: string) => {
    setEditingDish(null);
    setSelectedCategoryForDish(categoryId);
    setIsDishDialogOpen(true);
  };

  const handleEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setSelectedCategoryForDish(dish.menu_category_id ?? '');
    setIsDishDialogOpen(true);
  };

  const handleDeleteDish = (dishId: string, dishName: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Dish',
      description: `Delete "${dishName}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        try {
          const { error } = await supabase.from('dishes').delete().eq('id', dishId);
          if (error) throw error;
          toast.success('Dish deleted');
          fetchData();
        } catch (error: unknown) {
          console.error('[Admin] Error deleting dish:', error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          toast.error('Failed to delete: ' + message);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <PageHeader
          title="Menus"
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Restaurants', href: '/admin/restaurants' },
            { label: '...', href: `/admin/restaurants/${restaurantId}` },
            { label: 'Menus' },
          ]}
        />
        <LoadingSkeleton variant="table" count={3} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <PageHeader
        title={restaurantName}
        description="Manage menus, categories, and dishes"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Restaurants', href: '/admin/restaurants' },
          { label: restaurantName, href: `/admin/restaurants/${restaurantId}` },
          { label: 'Menus' },
        ]}
        actions={
          <Button onClick={handleAddMenu}>
            <Plus className="w-4 h-4 mr-2" />
            Add Menu
          </Button>
        }
      />

      {/* Menu Hierarchy */}
      <div className="space-y-4">
        {menus.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No menus yet"
            description="Add your first menu to start organizing dishes."
            action={{ label: 'Add Your First Menu', onClick: handleAddMenu }}
          />
        ) : (
          menus.map(menu => (
            <div key={menu.id} className="bg-white rounded-lg border border-gray-200">
              {/* Menu Header */}
              <div className="p-4 flex items-center justify-between bg-gray-50 rounded-t-lg">
                <div className="flex items-center space-x-3 flex-1">
                  <button
                    onClick={() => toggleMenuExpanded(menu.id)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    {expandedMenus.has(menu.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold">{menu.name}</h2>
                    {menu.description && (
                      <p className="text-sm text-gray-600">{menu.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {menu.categories?.length || 0} categories,{' '}
                      {menu.categories?.reduce((sum, cat) => sum + (cat.dishes?.length || 0), 0) ||
                        0}{' '}
                      dishes
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleAddCategory(menu.id)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Category
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditMenu(menu)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit Menu
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteMenu(menu.id, menu.name)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Menu
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Categories (expanded) */}
              {expandedMenus.has(menu.id) && (
                <div className="p-4 space-y-4">
                  {menu.categories && menu.categories.length > 0 ? (
                    menu.categories.map(category => (
                      <div key={category.id} className="border border-gray-200 rounded-lg">
                        {/* Category Header */}
                        <div className="p-3 bg-gray-50 flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium">{category.name}</h3>
                            {category.type && (
                              <span className="text-xs text-gray-500">{category.type}</span>
                            )}
                            <p className="text-xs text-gray-600 mt-1">
                              {category.dishes?.length || 0} dishes
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddDish(category.id)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Dish
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditCategory(category)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit Category
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteCategory(category.id, category.name)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Category
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Dishes */}
                        {category.dishes && category.dishes.length > 0 && (
                          <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {category.dishes.map(dish => (
                              <div
                                key={dish.id}
                                className="border rounded p-3 hover:shadow-md transition-shadow"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-medium text-sm">{dish.name}</h4>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="text-gray-400 hover:text-gray-600">
                                        <MoreVertical className="w-4 h-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleEditDish(dish)}>
                                        <Pencil className="w-3 h-3 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteDish(dish.id, dish.name)}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="w-3 h-3 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                {dish.description && (
                                  <p className="text-xs text-gray-600 mb-2">{dish.description}</p>
                                )}
                                <p className="text-sm font-semibold text-green-600">
                                  ${dish.price.toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Plus}
                      title="No categories yet"
                      description="Add a category to organize dishes within this menu."
                      action={{ label: 'Add First Category', onClick: () => handleAddCategory(menu.id) }}
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Menu Dialog */}
      {isMenuDialogOpen && (
        <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMenu ? 'Edit Menu' : 'Add Menu'}</DialogTitle>
              <DialogDescription>
                {editingMenu
                  ? 'Update menu details'
                  : 'Create a new menu (e.g., Breakfast, Lunch, Dinner)'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Menu Name</Label>
                <Input
                  value={menuFormData.name}
                  onChange={e => setMenuFormData({ ...menuFormData, name: e.target.value })}
                  placeholder="e.g., Breakfast, Lunch, Dinner, Brunch"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input
                  value={menuFormData.description}
                  onChange={e => setMenuFormData({ ...menuFormData, description: e.target.value })}
                  placeholder="e.g., Available 6am - 11am"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMenuDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMenu}>{editingMenu ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Category Dialog */}
      {isCategoryDialogOpen && (
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Update category details'
                  : 'Create a new category (e.g., Appetizers, Entrees, Drinks)'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category Name</Label>
                <Input
                  value={categoryFormData.name}
                  onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="e.g., Appetizers, Entrees, Soups"
                />
              </div>
              <div>
                <Label>Type (optional)</Label>
                <Input
                  value={categoryFormData.type}
                  onChange={e => setCategoryFormData({ ...categoryFormData, type: e.target.value })}
                  placeholder="e.g., appetizers, mains, desserts"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input
                  value={categoryFormData.description}
                  onChange={e =>
                    setCategoryFormData({ ...categoryFormData, description: e.target.value })
                  }
                  placeholder="Brief description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCategory}>{editingCategory ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dish Dialog */}
      {isDishDialogOpen && (
        <DishFormDialog
          isOpen={isDishDialogOpen}
          onClose={() => {
            setIsDishDialogOpen(false);
            setEditingDish(null);
          }}
          restaurantId={restaurantId}
          menuCategoryId={selectedCategoryForDish}
          dish={editingDish ? dbDishToFormDish(editingDish) : null}
          onSuccess={fetchData}
          restaurantCuisine={restaurantCuisine}
        />
      )}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState(s => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
}
