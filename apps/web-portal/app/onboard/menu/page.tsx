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
import { toast } from 'sonner';
import { Dish, Menu } from '@/types/restaurant';
import { menuSchema } from '@/lib/validation';
import { loadRestaurantData, saveRestaurantData } from '@/lib/storage';
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

export default function MenuPage() {
  const router = useRouter();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isDishDialogOpen, setIsDishDialogOpen] = useState(false);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuName, setMenuName] = useState('');

  // Initialize menus from saved data
  const initialMenus = useMemo(() => {
    if (typeof window === 'undefined') return [];

    const savedData = loadRestaurantData();
    if (savedData?.menus && savedData.menus.length > 0) {
      return savedData.menus;
    } else if (savedData?.dishes && savedData.dishes.length > 0) {
      // Migrate old single-menu format
      return [
        {
          id: crypto.randomUUID(),
          name: 'Main Menu',
          description: '',
          is_active: true,
          display_order: 1,
          dishes: savedData.dishes,
        },
      ];
    } else {
      // Create default menu
      return [
        {
          id: crypto.randomUUID(),
          name: 'Main Menu',
          description: '',
          is_active: true,
          display_order: 1,
          dishes: [],
        },
      ];
    }
  }, []);

  // Set initial state from loaded data
  useState(() => {
    if (initialMenus.length > 0 && !activeMenuId) {
      setMenus(initialMenus);
      setActiveMenuId(initialMenus[0].id);
    }
  });

  // Auto-save menus
  useEffect(() => {
    if (menus.length > 0) {
      const savedData = loadRestaurantData();
      // Flatten all dishes for backwards compatibility
      const allDishes = menus.flatMap(menu => menu.dishes);
      saveRestaurantData({
        basicInfo: savedData?.basicInfo || {},
        operations: savedData?.operations || {},
        menus,
        dishes: allDishes,
        currentStep: 3,
      });
    }
  }, [menus]);

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

  const handleNext = () => {
    const allDishes = menus.flatMap(menu => menu.dishes);
    const result = menuSchema.safeParse({ dishes: allDishes });

    if (!result.success) {
      toast.error('Please add at least one dish before continuing');
      return;
    }

    router.push('/onboard/review');
  };

  const handleBack = () => {
    router.push('/onboard/basic-info');
  };

  const handleOpenDishDialog = () => {
    setEditingDish(null);
    setIsDishDialogOpen(true);
  };

  const totalDishes = menus.reduce((sum, menu) => sum + menu.dishes.length, 0);

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
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Restaurant Info
          </Button>
          <Button onClick={handleNext} disabled={totalDishes === 0}>
            Continue to Review
            <ArrowRight className="ml-2 h-4 w-4" />
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
