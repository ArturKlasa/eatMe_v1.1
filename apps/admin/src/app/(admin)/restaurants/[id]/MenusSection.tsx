'use client';

import { useState } from 'react';
import type {
  AdminMenu,
  AdminMenuCategory,
  AdminMenuDish,
  DishCategoryOption,
} from '@/lib/auth/dal';
import { AddDishButton } from './AddDishButton';
import { CategoryRowEditor } from './CategoryRowEditor';
import { DishRowEditor } from './DishRowEditor';
import { MenuRowEditor } from './MenuRowEditor';

interface Props {
  restaurantId: string;
  menus: AdminMenu[];
  uncategorizedDishes: AdminMenuDish[];
  dishCategoryOptions: DishCategoryOption[];
}

function CategoryBlock({
  category,
  restaurantId,
  menus,
  dishCategoryOptions,
  onDishUpdated,
  onCategoryUpdated,
  onDishCreated,
}: {
  category: AdminMenuCategory;
  restaurantId: string;
  menus: AdminMenu[];
  dishCategoryOptions: DishCategoryOption[];
  onDishUpdated: (dishId: string, next: AdminMenuDish) => void;
  onCategoryUpdated: (next: AdminMenuCategory) => void;
  onDishCreated: (dish: AdminMenuDish) => void;
}) {
  return (
    <div className="rounded-md border border-border/60 p-3 space-y-2">
      <CategoryRowEditor
        category={category}
        restaurantId={restaurantId}
        onUpdated={onCategoryUpdated}
      />
      {category.dishes.length > 0 ? (
        <ul className="divide-y divide-border/40">
          {category.dishes.map(d => (
            <DishRowEditor
              key={d.id}
              dish={d}
              restaurantId={restaurantId}
              menus={menus}
              dishCategoryOptions={dishCategoryOptions}
              onUpdated={next => onDishUpdated(d.id, next)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground italic">No dishes in this category.</p>
      )}
      <AddDishButton
        restaurantId={restaurantId}
        menuCategoryId={category.id}
        categoryLabel={category.name}
        dishCategoryOptions={dishCategoryOptions}
        onCreated={onDishCreated}
      />
    </div>
  );
}

function MenuBlock({
  menu,
  restaurantId,
  menus,
  dishCategoryOptions,
  onDishUpdated,
  onCategoryUpdated,
  onMenuUpdated,
  onDishCreated,
}: {
  menu: AdminMenu;
  restaurantId: string;
  menus: AdminMenu[];
  dishCategoryOptions: DishCategoryOption[];
  onDishUpdated: (dishId: string, next: AdminMenuDish) => void;
  onCategoryUpdated: (next: AdminMenuCategory) => void;
  onMenuUpdated: (next: AdminMenu) => void;
  onDishCreated: (dish: AdminMenuDish) => void;
}) {
  const dishCount = menu.categories.reduce((acc, c) => acc + c.dishes.length, 0);
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <MenuRowEditor
        menu={menu}
        restaurantId={restaurantId}
        dishCount={dishCount}
        onUpdated={onMenuUpdated}
      />
      {menu.categories.length > 0 ? (
        <div className="space-y-2">
          {menu.categories.map(c => (
            <CategoryBlock
              key={c.id}
              category={c}
              restaurantId={restaurantId}
              menus={menus}
              dishCategoryOptions={dishCategoryOptions}
              onDishUpdated={onDishUpdated}
              onCategoryUpdated={onCategoryUpdated}
              onDishCreated={onDishCreated}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No categories in this menu.</p>
      )}
    </div>
  );
}

export function MenusSection({
  restaurantId,
  menus: initialMenus,
  uncategorizedDishes: initialUncategorized,
  dishCategoryOptions,
}: Props) {
  // Local state holds the optimistic copy. Edits go here first, then persist.
  // revalidatePath in the action will refresh the server data on next nav.
  const [menus, setMenus] = useState<AdminMenu[]>(initialMenus);
  const [uncategorizedDishes, setUncategorizedDishes] =
    useState<AdminMenuDish[]>(initialUncategorized);

  // Update a dish wherever it lives. If the user moved it to a different
  // menu_category_id (or to NULL), re-bucket it across the tree.
  function handleDishUpdated(dishId: string, next: AdminMenuDish) {
    // Strip from old location
    const stripFromMenus = (ms: AdminMenu[]): AdminMenu[] =>
      ms.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.filter(d => d.id !== dishId),
        })),
      }));
    const strippedMenus = stripFromMenus(menus);
    const strippedUncat = uncategorizedDishes.filter(d => d.id !== dishId);

    // Add to new location
    if (next.menu_category_id == null) {
      setMenus(strippedMenus);
      setUncategorizedDishes([...strippedUncat, next].sort((a, b) => a.name.localeCompare(b.name)));
      return;
    }

    let placed = false;
    const nextMenus = strippedMenus.map(m => ({
      ...m,
      categories: m.categories.map(c => {
        if (c.id === next.menu_category_id) {
          placed = true;
          return {
            ...c,
            dishes: [...c.dishes, next].sort((a, b) => a.name.localeCompare(b.name)),
          };
        }
        return c;
      }),
    }));

    // Defensive: if the target category isn't in the local tree (shouldn't
    // happen — server already validated), drop the dish into uncategorized
    // so it stays visible until the next refresh.
    if (!placed) {
      setMenus(strippedMenus);
      setUncategorizedDishes([...strippedUncat, next].sort((a, b) => a.name.localeCompare(b.name)));
      return;
    }

    setMenus(nextMenus);
    setUncategorizedDishes(strippedUncat);
  }

  // Update an edited category in place (preserves dishes inside).
  function handleCategoryUpdated(next: AdminMenuCategory) {
    setMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => (c.id === next.id ? { ...next, dishes: c.dishes } : c)),
      }))
    );
  }

  // Update an edited menu in place (preserves categories inside).
  function handleMenuUpdated(next: AdminMenu) {
    setMenus(prev => prev.map(m => (m.id === next.id ? { ...next, categories: m.categories } : m)));
  }

  // Insert a freshly-created dish into the right bucket. menu_category_id=null
  // → orphan list. Otherwise find the matching category in the menu tree.
  // Mirrors the "place" logic from handleDishUpdated; falls back to orphans
  // if the target category isn't in the local tree (defensive — shouldn't
  // happen since the server validated the FK).
  function handleDishCreated(dish: AdminMenuDish) {
    if (dish.menu_category_id == null) {
      setUncategorizedDishes(prev => [...prev, dish].sort((a, b) => a.name.localeCompare(b.name)));
      return;
    }
    let placed = false;
    const nextMenus = menus.map(m => ({
      ...m,
      categories: m.categories.map(c => {
        if (c.id === dish.menu_category_id) {
          placed = true;
          return {
            ...c,
            dishes: [...c.dishes, dish].sort((a, b) => a.name.localeCompare(b.name)),
          };
        }
        return c;
      }),
    }));
    if (!placed) {
      setUncategorizedDishes(prev => [...prev, dish].sort((a, b) => a.name.localeCompare(b.name)));
      return;
    }
    setMenus(nextMenus);
  }

  const totalCategories = menus.reduce((acc, m) => acc + m.categories.length, 0);
  const totalDishesInMenus = menus.reduce(
    (acc, m) => acc + m.categories.reduce((a, c) => a + c.dishes.length, 0),
    0
  );
  const orphanCount = uncategorizedDishes.length;

  return (
    <section className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-sm">Menus</h2>
        <span className="text-xs text-muted-foreground">
          {menus.length} menu{menus.length === 1 ? '' : 's'} · {totalCategories} categor
          {totalCategories === 1 ? 'y' : 'ies'} · {totalDishesInMenus} dish
          {totalDishesInMenus === 1 ? '' : 'es'}
          {orphanCount > 0 && ` · ${orphanCount} uncategorized`}
        </span>
      </div>

      {/*
        Orphan dishes (menu_category_id IS NULL): these have no schema link
        to any specific menu. Surface them at the top so the bug class is
        visible — putting them under an arbitrary menu would mislead.
      */}
      {orphanCount > 0 && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 space-y-2 dark:bg-yellow-950/30 dark:border-yellow-800">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-yellow-900 dark:text-yellow-200">
              ⚠ Uncategorized dishes
            </h3>
            <span className="text-xs text-yellow-800 dark:text-yellow-300">
              {orphanCount} dish{orphanCount === 1 ? '' : 'es'} not linked to any menu
            </span>
          </div>
          <ul className="divide-y divide-yellow-200 dark:divide-yellow-900">
            {uncategorizedDishes.map(d => (
              <DishRowEditor
                key={d.id}
                dish={d}
                restaurantId={restaurantId}
                menus={menus}
                dishCategoryOptions={dishCategoryOptions}
                onUpdated={next => handleDishUpdated(d.id, next)}
              />
            ))}
          </ul>
        </div>
      )}

      {menus.length > 0 ? (
        menus.map(m => (
          <MenuBlock
            key={m.id}
            menu={m}
            restaurantId={restaurantId}
            menus={menus}
            dishCategoryOptions={dishCategoryOptions}
            onDishUpdated={handleDishUpdated}
            onCategoryUpdated={handleCategoryUpdated}
            onMenuUpdated={handleMenuUpdated}
            onDishCreated={handleDishCreated}
          />
        ))
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No menus yet. Run a menu scan to populate.
        </p>
      )}
    </section>
  );
}
