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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DishCard } from '@/components/forms/DishCard';
import { DishFormDialog } from '@/components/forms/DishFormDialog';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { toast } from 'sonner';
import { Dish, Menu, SelectedIngredient } from '@/types/restaurant';
import { menuSchema } from '@/lib/validation';
import { loadRestaurantData, saveRestaurantData, clearRestaurantData } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { getRestaurantWithMenus, saveMenus } from '@/lib/restaurantService';
import {
  PlusCircle,
  ArrowLeft,
  ArrowRight,
  MoreVertical,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  UtensilsCrossed,
  GlassWater,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
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
  const [menuType, setMenuType] = useState<'food' | 'drink'>('food');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantCuisine, setRestaurantCuisine] = useState<string>('');
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Load menus from database
  useEffect(() => {
    const loadMenus = async () => {
      if (!user?.id) return;
      try {
        // Load cuisine from localStorage draft for dish category suggestions
        const savedData = loadRestaurantData(user.id);
        if (savedData?.basicInfo?.cuisines?.[0]) {
          setRestaurantCuisine(savedData.basicInfo.cuisines[0]);
        }

        const result = await getRestaurantWithMenus(user.id);
        if (result?.menus?.length) {
          setRestaurantId(result.id);
          setMenus(result.menus);
          setActiveMenuId(result.menus[0].id);
        } else {
          // Fall back to localStorage drafts
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
        console.error('[Menu] Failed to load menus:', err);
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
    setMenuType('food');
    setIsMenuDialogOpen(true);
  };

  const handleEditMenu = (menu: Menu) => {
    setEditingMenu(menu);
    setMenuName(menu.name);
    setMenuType(menu.menu_type ?? 'food');
    setIsMenuDialogOpen(true);
  };

  const handleSaveMenu = () => {
    if (!menuName.trim()) {
      toast.error('Please enter a menu name');
      return;
    }

    if (editingMenu) {
      // Update existing menu
      const updatedMenus = menus.map(m =>
        m.id === editingMenu.id ? { ...m, name: menuName, menu_type: menuType } : m
      );
      setMenus(updatedMenus);
      toast.success('Menu updated successfully!');
    } else {
      // Create new menu
      const newMenu: Menu = {
        id: crypto.randomUUID(),
        name: menuName,
        description: '',
        menu_type: menuType,
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
    setMenuType('food');
    setEditingMenu(null);
  };

  const handleDeleteMenu = (menuId: string) => {
    if (menus.length === 1) {
      toast.error('You must have at least one menu');
      return;
    }

    const menu = menus.find(m => m.id === menuId);
    setConfirmState({
      open: true,
      title: 'Delete Menu',
      description: `Are you sure you want to delete "${menu?.name || 'this menu'}"? All dishes in this menu will be removed.`,
      onConfirm: () => {
        const updatedMenus = menus.filter(m => m.id !== menuId);
        setMenus(updatedMenus);
        if (activeMenuId === menuId) {
          setActiveMenuId(updatedMenus[0]?.id || null);
        }
        toast.success('Menu deleted');
        setConfirmState(s => ({ ...s, open: false }));
      },
    });
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

    const dish = menus.find(m => m.id === activeMenuId)?.dishes.find(d => d.id === dishId);
    setConfirmState({
      open: true,
      title: 'Delete Dish',
      description: `Are you sure you want to delete "${dish?.name || 'this dish'}"? This action cannot be undone.`,
      onConfirm: () => {
        const updatedMenus = menus.map(menu =>
          menu.id === activeMenuId
            ? { ...menu, dishes: menu.dishes.filter(d => d.id !== dishId) }
            : menu
        );
        setMenus(updatedMenus);
        toast.success('Dish deleted');
        setConfirmState(s => ({ ...s, open: false }));
      },
    });
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
      if (!restaurantId) {
        toast.error('Restaurant not found. Please create restaurant information first.');
        setSaving(false);
        return;
      }

      await saveMenus(restaurantId, menus);
      clearRestaurantData(user.id); // B3: use storage helper instead of localStorage.removeItem
      toast.success('Menus and dishes saved successfully!');
      router.push('/');
    } catch (error) {
      console.error('[Menu] Save error:', error);
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
  const activeMenu = menus.find(m => m.id === activeMenuId) ?? null;
  const activeMenuType: 'food' | 'drink' = activeMenu?.menu_type ?? 'food';

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 py-8">
        <div className="container mx-auto px-4 max-w-5xl">
          <LoadingSkeleton variant="card" count={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Menu Management</h1>
          <p className="text-muted-foreground">
            Organize your menu items into different menus. Create multiple menus for different meal
            times or seasons.
          </p>
        </div>

        {/* Menus Tabs */}
        <Card className="mb-6">
          <Tabs value={activeMenuId || undefined} onValueChange={setActiveMenuId}>
            <div className="flex items-center justify-between p-4 border-b gap-2">
              <div className="flex-1">
              <TabsList className="flex-wrap gap-2 h-auto">
                {menus.map(menu => (
                  <TabsTrigger key={menu.id} value={menu.id}>
                    {menu.menu_type === 'drink' ? <GlassWater className="h-3.5 w-3.5 mr-1 inline-block" /> : <UtensilsCrossed className="h-3.5 w-3.5 mr-1 inline-block" />}
                    {menu.name}
                    {menu.dishes.length > 0 && (
                      <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                        {menu.dishes.length}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddMenu} className="shrink-0">
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
                        className="text-destructive"
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
                      <div className="bg-muted/30 rounded-full p-6">
                        <PlusCircle className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">No dishes in this menu yet</h3>
                        <p className="text-muted-foreground mb-4">Start adding dishes to {menu.name}</p>
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
          menuType={activeMenuType}
          restaurantCuisine={restaurantCuisine}
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
                <p className="text-xs text-muted-foreground mt-1">Menu Name will be visible to customers</p>
              </div>
              <div>
                <Label className="mb-2 block">Menu Type *</Label>
                <RadioGroup
                  value={menuType}
                  onValueChange={val => setMenuType(val as 'food' | 'drink')}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="food" id="menu-type-food" />
                    <Label htmlFor="menu-type-food" className="cursor-pointer font-normal">
                      <UtensilsCrossed className="h-3.5 w-3.5 inline-block mr-1" />Food Menu
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="drink" id="menu-type-drink" />
                    <Label htmlFor="menu-type-drink" className="cursor-pointer font-normal">
                      <GlassWater className="h-3.5 w-3.5 inline-block mr-1" />Drink Menu
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground mt-1">
                  Drink menus are excluded from food recommendations in the mobile app.
                </p>
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

        {/* Confirm Dialog for delete actions */}
        <ConfirmDialog
          {...confirmState}
          onOpenChange={(open) => setConfirmState(s => ({ ...s, open }))}
        />
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
