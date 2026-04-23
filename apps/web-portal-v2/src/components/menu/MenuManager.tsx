'use client';

import { useState, useTransition } from 'react';
import { PageGroupedList } from '@eatme/ui';
import { DishForm } from './DishForm';
import { createMenu, updateMenu, archiveMenu } from '@/app/(app)/restaurant/[id]/actions/menu';
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/app/(app)/restaurant/[id]/actions/category';
import { createDish, updateDish, archiveDish } from '@/app/(app)/restaurant/[id]/actions/dish';
import type { DishV2Input } from '@eatme/shared';

type CategoryWithDishes = {
  id: string;
  name: string;
  description: string | null;
  display_order: number | null;
  dishes: {
    id: string;
    name: string;
    price: number;
    dish_kind: string;
    primary_protein: string | null;
    status: string;
    is_template: boolean;
    is_available: boolean | null;
  }[];
};

type MenuWithCategories = {
  id: string;
  name: string;
  description: string | null;
  menu_type: string;
  status: string;
  categories: CategoryWithDishes[];
};

interface MenuManagerProps {
  restaurantId: string;
  menus: MenuWithCategories[];
}

export function MenuManager({ restaurantId, menus: initialMenus }: MenuManagerProps) {
  const [menus, setMenus] = useState(initialMenus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // UI state for inline forms
  const [addingMenu, setAddingMenu] = useState(false);
  const [addingCategoryForMenu, setAddingCategoryForMenu] = useState<string | null>(null);
  const [addingDishForCategory, setAddingDishForCategory] = useState<string | null>(null);
  const [editingDish, setEditingDish] = useState<string | null>(null);

  const [newMenuName, setNewMenuName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleCreateMenu = () => {
    if (!newMenuName.trim()) return;
    startTransition(async () => {
      const result = await createMenu(restaurantId, { name: newMenuName.trim() });
      if (result.ok) {
        setMenus(prev => [
          ...prev,
          {
            id: result.data.id,
            name: newMenuName.trim(),
            description: null,
            menu_type: 'food',
            status: 'draft',
            categories: [],
          },
        ]);
        setNewMenuName('');
        setAddingMenu(false);
      } else {
        setError(result.formError ?? 'Failed to create menu');
      }
    });
  };

  const handleArchiveMenu = (menuId: string) => {
    startTransition(async () => {
      const result = await archiveMenu(menuId, restaurantId);
      if (result.ok) {
        setMenus(prev => prev.filter(m => m.id !== menuId));
      } else {
        setError(result.formError ?? 'Failed to archive menu');
      }
    });
  };

  const handleCreateCategory = (menuId: string) => {
    if (!newCategoryName.trim()) return;
    startTransition(async () => {
      const result = await createCategory(restaurantId, {
        menu_id: menuId,
        name: newCategoryName.trim(),
      });
      if (result.ok) {
        setMenus(prev =>
          prev.map(m =>
            m.id === menuId
              ? {
                  ...m,
                  categories: [
                    ...m.categories,
                    {
                      id: result.data.id,
                      name: newCategoryName.trim(),
                      description: null,
                      display_order: m.categories.length,
                      dishes: [],
                    },
                  ],
                }
              : m
          )
        );
        setNewCategoryName('');
        setAddingCategoryForMenu(null);
      } else {
        setError(result.formError ?? 'Failed to create category');
      }
    });
  };

  const handleDeleteCategory = (menuId: string, categoryId: string) => {
    startTransition(async () => {
      const result = await deleteCategory(categoryId, restaurantId);
      if (result.ok) {
        setMenus(prev =>
          prev.map(m =>
            m.id === menuId
              ? { ...m, categories: m.categories.filter(c => c.id !== categoryId) }
              : m
          )
        );
      } else {
        setError(result.formError ?? 'Failed to delete category');
      }
    });
  };

  const handleCreateDish = (menuCategoryId: string, menuId: string) => {
    return async (input: DishV2Input) => {
      const result = await createDish(restaurantId, menuCategoryId, input);
      if (result.ok) {
        setMenus(prev =>
          prev.map(m =>
            m.id === menuId
              ? {
                  ...m,
                  categories: m.categories.map(c =>
                    c.id === menuCategoryId
                      ? {
                          ...c,
                          dishes: [
                            ...c.dishes,
                            {
                              id: result.data.id,
                              name: input.name,
                              price: input.price,
                              dish_kind: input.dish_kind,
                              primary_protein: input.primary_protein,
                              status: 'draft',
                              is_template:
                                input.dish_kind === 'configurable'
                                  ? (input.is_template ?? false)
                                  : false,
                              is_available: input.is_available ?? true,
                            },
                          ],
                        }
                      : c
                  ),
                }
              : m
          )
        );
        setAddingDishForCategory(null);
      }
      return result;
    };
  };

  const handleUpdateDish = (dishId: string, restaurantId: string) => {
    return async (input: DishV2Input) => {
      const result = await updateDish(dishId, restaurantId, input);
      if (result.ok) {
        setEditingDish(null);
        setMenus(prev =>
          prev.map(m => ({
            ...m,
            categories: m.categories.map(c => ({
              ...c,
              dishes: c.dishes.map(d =>
                d.id === dishId
                  ? {
                      ...d,
                      name: input.name,
                      price: input.price,
                      dish_kind: input.dish_kind,
                      primary_protein: input.primary_protein,
                      is_template:
                        input.dish_kind === 'configurable' ? (input.is_template ?? false) : false,
                    }
                  : d
              ),
            })),
          }))
        );
      }
      return result;
    };
  };

  const handleArchiveDish = (dishId: string, menuId: string, categoryId: string) => {
    startTransition(async () => {
      const result = await archiveDish(dishId, restaurantId);
      if (result.ok) {
        setMenus(prev =>
          prev.map(m =>
            m.id === menuId
              ? {
                  ...m,
                  categories: m.categories.map(c =>
                    c.id === categoryId
                      ? { ...c, dishes: c.dishes.filter(d => d.id !== dishId) }
                      : c
                  ),
                }
              : m
          )
        );
      } else {
        setError(result.formError ?? 'Failed to archive dish');
      }
    });
  };

  const groups = menus.map(menu => ({
    id: menu.id,
    title: menu.name,
    meta: (
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${
          menu.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {menu.status}
      </span>
    ),
    headerAction: (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAddingCategoryForMenu(menu.id);
            setNewCategoryName('');
          }}
          className="text-xs text-primary hover:underline"
          data-testid={`add-category-btn-${menu.id}`}
        >
          + Category
        </button>
        <button
          type="button"
          onClick={() => handleArchiveMenu(menu.id)}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Archive
        </button>
      </div>
    ),
    children: (
      <div className="space-y-4">
        {menu.categories.map(cat => (
          <div key={cat.id} className="border border-border rounded-md">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded-t-md">
              <span className="text-sm font-medium" data-testid={`category-name-${cat.id}`}>
                {cat.name}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddingDishForCategory(cat.id)}
                  className="text-xs text-primary hover:underline"
                  data-testid={`add-dish-btn-${cat.id}`}
                >
                  + Dish
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(menu.id, cat.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Add dish form */}
            {addingDishForCategory === cat.id && (
              <div className="p-3 border-t border-border" data-testid="dish-form">
                <DishForm
                  restaurantId={restaurantId}
                  menuCategoryId={cat.id}
                  onSubmit={handleCreateDish(cat.id, menu.id)}
                  onCancel={() => setAddingDishForCategory(null)}
                  submitLabel="Create dish"
                />
              </div>
            )}

            {/* Dish list */}
            <div className="divide-y divide-border">
              {cat.dishes.map(dish => (
                <div key={dish.id}>
                  {editingDish === dish.id ? (
                    <div className="p-3" data-testid={`edit-dish-form-${dish.id}`}>
                      <DishForm
                        restaurantId={restaurantId}
                        menuCategoryId={cat.id}
                        defaultValues={{
                          name: dish.name,
                          price: dish.price,
                          dish_kind: dish.dish_kind as DishV2Input['dish_kind'],
                          primary_protein: dish.primary_protein as DishV2Input['primary_protein'],
                          is_template: dish.is_template,
                          is_available: dish.is_available ?? true,
                        }}
                        onSubmit={handleUpdateDish(dish.id, restaurantId)}
                        onCancel={() => setEditingDish(null)}
                        submitLabel="Update dish"
                      />
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between px-3 py-2"
                      data-testid={`dish-row-${dish.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{dish.name}</span>
                        <span className="text-xs text-muted-foreground">${dish.price}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {dish.dish_kind}
                        </span>
                        {dish.is_template && (
                          <span className="text-xs text-amber-600">template</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingDish(dish.id)}
                          className="text-xs text-primary hover:underline"
                          data-testid={`edit-dish-btn-${dish.id}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchiveDish(dish.id, menu.id, cat.id)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {cat.dishes.length === 0 && addingDishForCategory !== cat.id && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No dishes yet.</p>
              )}
            </div>
          </div>
        ))}

        {/* Add category inline form */}
        {addingCategoryForMenu === menu.id && (
          <div className="flex gap-2 items-center" data-testid="add-category-form">
            <input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="Category name (e.g. Mains)"
              className="flex-1 h-8 rounded border border-border px-2 text-sm"
              data-testid="category-name-input"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateCategory(menu.id);
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleCreateCategory(menu.id)}
              className="px-3 h-8 bg-primary text-primary-foreground rounded text-sm"
              data-testid="category-save-btn"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setAddingCategoryForMenu(null)}
              className="px-3 h-8 border border-border rounded text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {menu.categories.length === 0 && addingCategoryForMenu !== menu.id && (
          <p className="text-sm text-muted-foreground">
            No categories yet.{' '}
            <button
              type="button"
              onClick={() => setAddingCategoryForMenu(menu.id)}
              className="text-primary underline"
            >
              Add one
            </button>
          </p>
        )}
      </div>
    ),
  }));

  return (
    <div data-testid="menu-manager">
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <PageGroupedList
        groups={groups}
        emptyState={
          <p className="text-muted-foreground text-sm">
            No menus yet. Create your first menu to get started.
          </p>
        }
      />

      {/* Add menu */}
      {addingMenu ? (
        <div className="flex gap-2 items-center mt-4" data-testid="add-menu-form">
          <input
            value={newMenuName}
            onChange={e => setNewMenuName(e.target.value)}
            placeholder="Menu name (e.g. Lunch)"
            className="flex-1 h-9 rounded border border-border px-3 text-sm"
            data-testid="menu-name-input"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateMenu();
              }
            }}
          />
          <button
            type="button"
            onClick={handleCreateMenu}
            disabled={isPending}
            className="px-4 h-9 bg-primary text-primary-foreground rounded text-sm disabled:opacity-60"
            data-testid="menu-save-btn"
          >
            {isPending ? 'Creating…' : 'Create menu'}
          </button>
          <button
            type="button"
            onClick={() => setAddingMenu(false)}
            className="px-4 h-9 border border-border rounded text-sm"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingMenu(true)}
          className="mt-4 px-4 py-2 border border-dashed border-border rounded text-sm text-muted-foreground hover:border-primary hover:text-primary"
          data-testid="add-menu-btn"
        >
          + Add menu
        </button>
      )}
    </div>
  );
}
