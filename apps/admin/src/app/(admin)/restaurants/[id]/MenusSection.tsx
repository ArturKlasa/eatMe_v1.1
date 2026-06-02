'use client';

import { useState, type CSSProperties } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type {
  AdminMenu,
  AdminMenuCategory,
  AdminMenuDish,
  CanonicalCategoryOption,
  DishCategoryOption,
} from '@/lib/auth/dal';
import { AddCategoryButton } from './AddCategoryButton';
import { AddDishButton } from './AddDishButton';
import { AddMenuButton } from './AddMenuButton';
import { CategoryRowEditor } from './CategoryRowEditor';
import { DishRowEditor } from './DishRowEditor';
import { MenuRowEditor } from './MenuRowEditor';
import { adminReorderMenuCategories } from './actions/menuCategory';

interface Props {
  restaurantId: string;
  menus: AdminMenu[];
  uncategorizedDishes: AdminMenuDish[];
  dishCategoryOptions: DishCategoryOption[];
  canonicalCategoryOptions: CanonicalCategoryOption[];
  // ISO-639-1 derived from the restaurant's country_code. Threaded through
  // to AddCategoryButton so newly-created menu_categories carry the right
  // source_language_code + name_translations.
  sourceLanguageCode: string;
  // ISO 4217 from restaurants.currency_code. Threaded down to every dish-price
  // render + input so amounts display in the restaurant's currency.
  currencyCode: string;
}

function CategoryBlock({
  category,
  restaurantId,
  menus,
  dishCategoryOptions,
  currencyCode,
  draggable,
  onDishUpdated,
  onCategoryUpdated,
  onDishCreated,
  onDishCategoryCreated,
}: {
  category: AdminMenuCategory;
  restaurantId: string;
  menus: AdminMenu[];
  dishCategoryOptions: DishCategoryOption[];
  currencyCode: string;
  // Whether the drag handle is shown — false when the menu has a lone category.
  draggable: boolean;
  onDishUpdated: (dishId: string, next: AdminMenuDish) => void;
  onCategoryUpdated: (next: AdminMenuCategory) => void;
  onDishCreated: (dish: AdminMenuDish) => void;
  onDishCategoryCreated: (cat: DishCategoryOption) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border border-border/60 p-3 space-y-2"
    >
      <div className="flex items-start gap-1.5">
        {draggable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-0.5 shrink-0 cursor-grab p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
            aria-label={`Drag to reorder ${category.name}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <CategoryRowEditor
            category={category}
            restaurantId={restaurantId}
            onUpdated={onCategoryUpdated}
          />
        </div>
      </div>
      {category.dishes.length > 0 ? (
        <ul className="divide-y divide-border/40">
          {category.dishes.map(d => (
            <DishRowEditor
              key={d.id}
              dish={d}
              restaurantId={restaurantId}
              menus={menus}
              dishCategoryOptions={dishCategoryOptions}
              currencyCode={currencyCode}
              onUpdated={next => onDishUpdated(d.id, next)}
              onDishCategoryCreated={onDishCategoryCreated}
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
        currencyCode={currencyCode}
        onCreated={onDishCreated}
        onDishCategoryCreated={onDishCategoryCreated}
      />
    </div>
  );
}

function MenuBlock({
  menu,
  restaurantId,
  menus,
  dishCategoryOptions,
  canonicalCategoryOptions,
  sourceLanguageCode,
  currencyCode,
  onDishUpdated,
  onCategoryUpdated,
  onMenuUpdated,
  onDishCreated,
  onCategoryCreated,
  onDishCategoryCreated,
  onCategoriesReordered,
}: {
  menu: AdminMenu;
  restaurantId: string;
  menus: AdminMenu[];
  dishCategoryOptions: DishCategoryOption[];
  canonicalCategoryOptions: CanonicalCategoryOption[];
  sourceLanguageCode: string;
  currencyCode: string;
  onDishUpdated: (dishId: string, next: AdminMenuDish) => void;
  onCategoryUpdated: (next: AdminMenuCategory) => void;
  onMenuUpdated: (next: AdminMenu) => void;
  onDishCreated: (dish: AdminMenuDish) => void;
  onCategoryCreated: (category: AdminMenuCategory) => void;
  onDishCategoryCreated: (cat: DishCategoryOption) => void;
  onCategoriesReordered: (menuId: string, orderedCategoryIds: string[]) => void;
}) {
  const dishCount = menu.categories.reduce((acc, c) => acc + c.dishes.length, 0);

  const sensors = useSensors(useSensor(PointerSensor));

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = menu.categories.findIndex(c => c.id === active.id);
    const toIdx = menu.categories.findIndex(c => c.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;
    const orderedIds = arrayMove(
      menu.categories.map(c => c.id),
      fromIdx,
      toIdx
    );
    onCategoriesReordered(menu.id, orderedIds);
  }

  // Filter out canonicals already linked under THIS menu (mig 124's partial
  // unique index would block the insert anyway). The same canonical can still
  // appear in a different menu of the same restaurant — Lunch + Dinner can
  // both have a "Drinks" section, for example.
  const usedCanonicalIds = new Set(
    menu.categories.map(c => c.canonical_category_id).filter((id): id is string => id != null)
  );
  const availableCanonicalOptions = canonicalCategoryOptions.filter(
    c => !usedCanonicalIds.has(c.id)
  );

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <MenuRowEditor
        menu={menu}
        restaurantId={restaurantId}
        dishCount={dishCount}
        onUpdated={onMenuUpdated}
      />
      {menu.categories.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext
            items={menu.categories.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {menu.categories.map(c => (
                <CategoryBlock
                  key={c.id}
                  category={c}
                  restaurantId={restaurantId}
                  menus={menus}
                  dishCategoryOptions={dishCategoryOptions}
                  currencyCode={currencyCode}
                  draggable={menu.categories.length > 1}
                  onDishUpdated={onDishUpdated}
                  onCategoryUpdated={onCategoryUpdated}
                  onDishCreated={onDishCreated}
                  onDishCategoryCreated={onDishCategoryCreated}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-xs text-muted-foreground italic">No categories in this menu.</p>
      )}
      <AddCategoryButton
        restaurantId={restaurantId}
        menuId={menu.id}
        menuName={menu.name}
        sourceLanguageCode={sourceLanguageCode}
        availableCanonicalOptions={availableCanonicalOptions}
        onCreated={onCategoryCreated}
      />
    </div>
  );
}

export function MenusSection({
  restaurantId,
  menus: initialMenus,
  uncategorizedDishes: initialUncategorized,
  dishCategoryOptions: initialDishCategoryOptions,
  canonicalCategoryOptions,
  sourceLanguageCode,
  currencyCode,
}: Props) {
  // Local state holds the optimistic copy. Edits go here first, then persist.
  // revalidatePath in the action will refresh the server data on next nav.
  const [menus, setMenus] = useState<AdminMenu[]>(initialMenus);
  const [uncategorizedDishes, setUncategorizedDishes] =
    useState<AdminMenuDish[]>(initialUncategorized);
  // Lifted so newly-created dish categories from any DishRowEditor or
  // AddDishButton appear in every sibling's combobox without a page reload.
  const [dishCategoryOptions, setDishCategoryOptions] = useState<DishCategoryOption[]>(
    initialDishCategoryOptions
  );
  const [reorderError, setReorderError] = useState('');

  // Append a freshly-created (or already-existing, idempotent) dish_category
  // and re-sort alphabetically to match how getAllDishCategoryOptions returns
  // them.
  function handleDishCategoryCreated(cat: DishCategoryOption) {
    setDishCategoryOptions(prev => {
      const next = prev.some(c => c.id === cat.id) ? prev : [...prev, cat];
      return [...next].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

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

  // Persist a drag-reordered category list for one menu. Optimistically applies
  // the new order (and refreshes each display_order); on failure restores the
  // pre-drag order for that menu only.
  async function handleCategoriesReordered(menuId: string, orderedIds: string[]) {
    setReorderError('');
    const menu = menus.find(m => m.id === menuId);
    if (!menu) return;
    const prevCategories = menu.categories;

    const byId = new Map(prevCategories.map(c => [c.id, c]));
    const reordered = orderedIds
      .map(id => byId.get(id))
      .filter((c): c is AdminMenuCategory => c != null)
      .map((c, i) => ({ ...c, display_order: i }));
    if (reordered.length !== prevCategories.length) return;

    setMenus(prev => prev.map(m => (m.id === menuId ? { ...m, categories: reordered } : m)));

    const result = await adminReorderMenuCategories(restaurantId, menuId, orderedIds);
    if (!result.ok) {
      setMenus(prev => prev.map(m => (m.id === menuId ? { ...m, categories: prevCategories } : m)));
      setReorderError(
        result.formError === 'STALE_ORDER'
          ? 'Categories changed since this page loaded — refresh and try again.'
          : 'Could not save the new category order.'
      );
    }
  }

  // Update an edited menu in place (preserves categories inside).
  function handleMenuUpdated(next: AdminMenu) {
    setMenus(prev => prev.map(m => (m.id === next.id ? { ...next, categories: m.categories } : m)));
  }

  // Insert a freshly-created menu at the bottom of the menus list. categories
  // is always [] for a new menu — admin will populate it via the per-menu
  // AddCategoryButton.
  function handleMenuCreated(menu: AdminMenu) {
    setMenus(prev => [...prev, { ...menu, categories: [] }]);
  }

  // Insert a freshly-created category at the bottom of its parent menu's
  // category list. dishes is always [] for a new category.
  function handleCategoryCreated(category: AdminMenuCategory) {
    setMenus(prev =>
      prev.map(m =>
        m.id === category.menu_id
          ? { ...m, categories: [...m.categories, { ...category, dishes: [] }] }
          : m
      )
    );
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

      {reorderError && <p className="text-xs text-destructive">{reorderError}</p>}

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
                currencyCode={currencyCode}
                onUpdated={next => handleDishUpdated(d.id, next)}
                onDishCategoryCreated={handleDishCategoryCreated}
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
            canonicalCategoryOptions={canonicalCategoryOptions}
            sourceLanguageCode={sourceLanguageCode}
            currencyCode={currencyCode}
            onDishUpdated={handleDishUpdated}
            onCategoryUpdated={handleCategoryUpdated}
            onMenuUpdated={handleMenuUpdated}
            onDishCreated={handleDishCreated}
            onCategoryCreated={handleCategoryCreated}
            onDishCategoryCreated={handleDishCategoryCreated}
            onCategoriesReordered={handleCategoriesReordered}
          />
        ))
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No menus yet. Run a menu scan to populate, or add one manually below.
        </p>
      )}

      <AddMenuButton restaurantId={restaurantId} onCreated={handleMenuCreated} />
    </section>
  );
}
