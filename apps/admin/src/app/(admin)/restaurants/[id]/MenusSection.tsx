import type { AdminMenu, AdminMenuCategory, AdminMenuDish } from '@/lib/auth/dal';

interface Props {
  menus: AdminMenu[];
  uncategorizedDishes: AdminMenuDish[];
}

function statusBadgeClass(status: string) {
  if (status === 'published') return 'bg-green-100 text-green-800';
  if (status === 'draft') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return price.toFixed(2);
}

function DishRow({ dish }: { dish: AdminMenuDish }) {
  return (
    <li className="flex items-baseline gap-2 py-1 text-sm">
      <span className="flex-1 text-foreground">{dish.name}</span>
      <span className="tabular-nums text-muted-foreground w-16 text-right">
        {formatPrice(dish.price)}
      </span>
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(dish.status)}`}
      >
        {dish.status}
      </span>
      {dish.dish_kind !== 'standard' && (
        <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          {dish.dish_kind}
        </span>
      )}
      {dish.is_template && (
        <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          template
        </span>
      )}
      {dish.is_available === false && (
        <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
          unavailable
        </span>
      )}
      <span
        className="w-32 truncate text-xs text-muted-foreground"
        title={dish.dish_category_name ?? ''}
      >
        {dish.dish_category_name ?? '—'}
      </span>
    </li>
  );
}

function CategoryBlock({ category }: { category: AdminMenuCategory }) {
  const isCanonical = category.canonical_category_id != null;
  return (
    <div className="rounded-md border border-border/60 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="font-medium text-sm">{category.name}</h4>
        <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {isCanonical ? 'Canonical' : 'Custom'}
        </span>
        {!category.is_active && (
          <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            Inactive
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {category.dishes.length} dish{category.dishes.length === 1 ? '' : 'es'}
        </span>
      </div>
      {category.description && (
        <p className="text-xs italic text-muted-foreground">{category.description}</p>
      )}
      {category.dishes.length > 0 ? (
        <ul className="divide-y divide-border/40">
          {category.dishes.map(d => (
            <DishRow key={d.id} dish={d} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground italic">No dishes in this category.</p>
      )}
    </div>
  );
}

function MenuBlock({ menu }: { menu: AdminMenu }) {
  const dishCount = menu.categories.reduce((acc, c) => acc + c.dishes.length, 0);
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-sm">{menu.name}</h3>
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(menu.status)}`}
        >
          {menu.status}
        </span>
        <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          {menu.menu_type}
        </span>
        {!menu.is_active && (
          <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            Inactive
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {menu.categories.length} categor{menu.categories.length === 1 ? 'y' : 'ies'} · {dishCount}{' '}
          dish{dishCount === 1 ? '' : 'es'}
        </span>
      </div>
      {menu.description && (
        <p className="text-xs italic text-muted-foreground">{menu.description}</p>
      )}
      {menu.categories.length > 0 ? (
        <div className="space-y-2">
          {menu.categories.map(c => (
            <CategoryBlock key={c.id} category={c} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No categories in this menu.</p>
      )}
    </div>
  );
}

export function MenusSection({ menus, uncategorizedDishes }: Props) {
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
              <DishRow key={d.id} dish={d} />
            ))}
          </ul>
        </div>
      )}

      {menus.length > 0 ? (
        menus.map(m => <MenuBlock key={m.id} menu={m} />)
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No menus yet. Run a menu scan to populate.
        </p>
      )}
    </section>
  );
}
