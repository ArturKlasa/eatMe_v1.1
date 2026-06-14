/**
 * FoodTab
 *
 * Renders the "Food & Drinks" tab content: the full list of menus, their
 * categories, and dish rows. Every dish renders through the same standard row +
 * inline modifier list.
 *
 * The nested menu → category → dish structure is flattened into a single typed-row
 * array and rendered through a virtualized FlatList, so only on-screen rows mount
 * (a long menu no longer mounts every DishMenuItem + ModifierGroupsList up front).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { restaurantDetailStyles as styles } from '@/styles';
import { colors, spacing } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { type RestaurantWithMenus, type MenuCategoryWithCanonical } from '../../lib/supabase';
import { useFilterStore, type PermanentFilters } from '../../stores/filterStore';
import { type DishRating } from '../../services/dishRatingService';
import { type DishOpinion } from '../../types/rating';
import { type DishWithGroups } from './dishTypes';
import { classifyDish, sortDishesByFilter } from '../../utils/menuFilterUtils';
import { DishMenuItem } from './DishMenuItem';
import { ModifierGroupsList } from './ModifierGroupsList';

interface FoodTabProps {
  restaurant: RestaurantWithMenus;
  categoryDishes: Map<string, DishWithGroups[] | 'loading' | 'error'>;
  dishRatings: Map<string, DishRating>;
  userDishOpinions: Map<string, DishOpinion>;
  permanentFilters: PermanentFilters;
  /** Dish ids the user has favorited — renders the ❤️ marker on menu rows. */
  favoriteDishIds: Set<string>;
  /** Dish the user tapped on the map/favorites to get here — rendered as a
   *  pinned highlighted block above the menu list (and again in its category). */
  featuredDishId?: string;
  loadCategoryDishes: (categoryId: string) => void;
  onDishPress: (dish: DishWithGroups) => void;
}

/** A dish row plus its precomputed hard-filter verdict (classified once, here). */
type ClassifiedDish = DishWithGroups & { passesHardFilters: boolean };

type RestaurantMenu = NonNullable<RestaurantWithMenus['menus']>[number];

/** One flattened, virtualizable row of the menu list. */
type MenuRow =
  | { key: string; kind: 'featured'; dish: ClassifiedDish }
  | { key: string; kind: 'menuHeader'; menu: RestaurantMenu; expanded: boolean }
  | { key: string; kind: 'menuDescription'; text: string }
  | { key: string; kind: 'categoryHeader'; category: MenuCategoryWithCanonical }
  | { key: string; kind: 'categoryLoading' }
  | { key: string; kind: 'categoryError' }
  | { key: string; kind: 'categoryLoad'; categoryId: string }
  | { key: string; kind: 'dish'; dish: ClassifiedDish };

// Display name resolution for menu_categories rows.
// Order: name_translations[locale] → canonical.names[locale] → canonical.names.en → name (source language).
function resolveCategoryName(category: MenuCategoryWithCanonical, locale: string): string {
  return (
    category.name_translations?.[locale] ??
    category.canonical?.names?.[locale] ??
    category.canonical?.names?.en ??
    category.name
  );
}

// Description follows the same COALESCE pattern (no canonical fallback —
// descriptions are restaurant-specific by design, not on the canonical taxonomy).
function resolveCategoryDescription(
  category: MenuCategoryWithCanonical,
  locale: string
): string | null {
  return category.description_translations?.[locale] ?? category.description ?? null;
}

export function FoodTab({
  restaurant,
  categoryDishes,
  dishRatings,
  userDishOpinions,
  permanentFilters,
  favoriteDishIds,
  featuredDishId,
  loadCategoryDishes,
  onDishPress,
}: FoodTabProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const locale = i18n.language;
  const dailyFilters = useFilterStore(state => state.daily);

  // Resolve the featured dish once its category data has lazy-loaded.
  const featuredDish = useMemo(() => {
    if (!featuredDishId) return null;
    for (const state of categoryDishes.values()) {
      if (!Array.isArray(state)) continue;
      const direct = (state as DishWithGroups[]).find(d => d.id === featuredDishId);
      if (direct) return direct;
    }
    return null;
  }, [featuredDishId, categoryDishes]);

  // Classify + sort each category's dishes ONCE per [data, filters] change, keyed by
  // category id. Replaces the per-render inline sort; passesHardFilters rides along so
  // DishMenuItem never re-classifies (it was doing the same work a second time).
  const sortedByCategory = useMemo(() => {
    const out = new Map<string, ClassifiedDish[]>();
    for (const [catId, state] of categoryDishes) {
      if (!Array.isArray(state)) continue;
      const classified: ClassifiedDish[] = (state as DishWithGroups[]).map(d => ({
        ...d,
        passesHardFilters: classifyDish(d, permanentFilters).passesHardFilters,
      }));
      out.set(catId, sortDishesByFilter(classified));
    }
    return out;
  }, [categoryDishes, permanentFilters]);

  // With a single menu the menu-name heading (often the generic "Main Menu"
  // default, or a foreign-language AI-scanned name like "Comidas y Cenas") is
  // redundant — it just pushes the categories down. Suppress it so the list
  // sits under the tabs. Multiple menus keep their names to stay
  // distinguishable (e.g. a food menu vs a separate drinks menu).
  const singleMenu = (restaurant.menus?.length ?? 0) <= 1;

  // Multiple menus render collapsed by default: the top of the tab becomes a
  // compact menu picker the user expands one at a time.
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const toggleMenu = useCallback((menuId: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  }, []);

  // Flatten menus → categories → dishes into one virtualizable row list. Collapsed
  // menus contribute only their header; single-menu restaurants stay header-less and
  // always expanded. The featured dish is pinned on top AND still appears in its
  // category below (unchanged from the nested-map version).
  const rows = useMemo<MenuRow[]>(() => {
    const out: MenuRow[] = [];
    if (featuredDish) {
      out.push({
        key: `featured:${featuredDish.id}`,
        kind: 'featured',
        dish: {
          ...featuredDish,
          passesHardFilters: classifyDish(featuredDish, permanentFilters).passesHardFilters,
        },
      });
    }
    for (const menu of restaurant.menus ?? []) {
      const expanded = singleMenu || expandedMenus.has(menu.id);
      if (!singleMenu) {
        out.push({ key: `menuHeader:${menu.id}`, kind: 'menuHeader', menu, expanded });
      }
      if (expanded && !singleMenu && menu.description) {
        out.push({ key: `menuDesc:${menu.id}`, kind: 'menuDescription', text: menu.description });
      }
      if (!expanded) continue;
      for (const category of menu.menu_categories ?? []) {
        out.push({ key: `catHeader:${category.id}`, kind: 'categoryHeader', category });
        const state = categoryDishes.get(category.id);
        if (state === 'loading') {
          out.push({ key: `catLoading:${category.id}`, kind: 'categoryLoading' });
        } else if (state === 'error') {
          out.push({ key: `catError:${category.id}`, kind: 'categoryError' });
        } else if (state === undefined) {
          out.push({
            key: `catLoad:${category.id}`,
            kind: 'categoryLoad',
            categoryId: category.id,
          });
        } else {
          for (const dish of sortedByCategory.get(category.id) ?? []) {
            out.push({ key: `dish:${dish.id}`, kind: 'dish', dish });
          }
        }
      }
    }
    return out;
  }, [
    restaurant.menus,
    categoryDishes,
    sortedByCategory,
    expandedMenus,
    singleMenu,
    featuredDish,
    permanentFilters,
  ]);

  // FlatList only re-renders rows when data (rows) or extraData changes. Ratings /
  // opinions / favourites arrive without changing `rows`, so surface them here; the
  // memoized DishMenuItem still skips rows whose own resolved props didn't change.
  const extraData = useMemo(
    () => ({ dishRatings, userDishOpinions, favoriteDishIds }),
    [dishRatings, userDishOpinions, favoriteDishIds]
  );

  const keyExtractor = useCallback((row: MenuRow) => row.key, []);

  const renderItem = useCallback(
    ({ item }: { item: MenuRow }) => {
      switch (item.kind) {
        case 'featured': {
          const dish = item.dish;
          return (
            <View style={styles.featuredSection}>
              <Text style={styles.featuredLabel}>⭐ {t('restaurant.featuredFromSearch')}</Text>
              <DishMenuItem
                item={dish}
                passesHardFilters={dish.passesHardFilters}
                rating={dishRatings.get(dish.id) ?? null}
                currencyCode={restaurant.currency_code}
                userOpinion={userDishOpinions.get(dish.id) ?? null}
                isFavorite={favoriteDishIds.has(dish.id)}
                onPress={onDishPress}
              />
              {(dish.option_groups?.length ?? 0) > 0 && (
                <View style={localStyles.modifierWrap}>
                  <ModifierGroupsList
                    groups={dish.option_groups ?? []}
                    daily={dailyFilters}
                    basePrice={dish.price ?? 0}
                    currencyCode={restaurant.currency_code}
                  />
                </View>
              )}
            </View>
          );
        }
        case 'menuHeader':
          return (
            <TouchableOpacity
              style={styles.menuHeader}
              onPress={() => toggleMenu(item.menu.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuHeaderName} numberOfLines={1}>
                {item.menu.name}
              </Text>
              <Text style={styles.menuChevron}>{item.expanded ? '▴' : '▾'}</Text>
            </TouchableOpacity>
          );
        case 'menuDescription':
          return <Text style={styles.menuDescription}>{item.text}</Text>;
        case 'categoryHeader': {
          const desc = resolveCategoryDescription(item.category, locale);
          return (
            <TouchableOpacity
              style={[localStyles.categoryHeaderPad, styles.categoryHeader]}
              onPress={() => loadCategoryDishes(item.category.id)}
              activeOpacity={1}
            >
              <Text style={styles.categoryName}>{resolveCategoryName(item.category, locale)}</Text>
              {desc ? <Text style={styles.categoryDescription}>{desc}</Text> : null}
            </TouchableOpacity>
          );
        }
        case 'categoryLoading':
          return (
            <View style={localStyles.categoryRowPad}>
              <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 8 }} />
            </View>
          );
        case 'categoryError':
          return (
            <View style={localStyles.categoryRowPad}>
              <Text style={{ color: colors.textSecondary, padding: 8 }}>{t('common.error')}</Text>
            </View>
          );
        case 'categoryLoad':
          return (
            <View style={localStyles.categoryRowPad}>
              <TouchableOpacity
                style={{ padding: 8 }}
                onPress={() => loadCategoryDishes(item.categoryId)}
              >
                <Text style={{ color: colors.accent }}>
                  {t('restaurant.loadDishes', 'Load dishes')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        case 'dish': {
          const dish = item.dish;
          return (
            // categoryRowPad replicates the old menuCategory horizontal inset; the inner
            // dishRow keeps the divider inset (not full-bleed) exactly as before.
            <View style={localStyles.categoryRowPad}>
              <View style={localStyles.dishRow}>
                <DishMenuItem
                  item={dish}
                  passesHardFilters={dish.passesHardFilters}
                  rating={dishRatings.get(dish.id) ?? null}
                  currencyCode={restaurant.currency_code}
                  userOpinion={userDishOpinions.get(dish.id) ?? null}
                  isFavorite={favoriteDishIds.has(dish.id)}
                  onPress={onDishPress}
                />
                {(dish.option_groups?.length ?? 0) > 0 && (
                  <View style={localStyles.modifierWrap}>
                    <ModifierGroupsList
                      groups={dish.option_groups ?? []}
                      daily={dailyFilters}
                      basePrice={dish.price ?? 0}
                      currencyCode={restaurant.currency_code}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        }
        default:
          return null;
      }
    },
    [
      t,
      locale,
      dishRatings,
      userDishOpinions,
      favoriteDishIds,
      restaurant.currency_code,
      dailyFilters,
      onDishPress,
      loadCategoryDishes,
      toggleMenu,
    ]
  );

  return (
    <FlatList
      style={styles.scrollView}
      data={rows}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      extraData={extraData}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
      ListEmptyComponent={
        <View style={{ padding: spacing['2xl'], alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>{t('restaurant.noMenuItems')}</Text>
        </View>
      }
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={11}
      removeClippedSubviews
      nestedScrollEnabled
    />
  );
}

const localStyles = StyleSheet.create({
  // Replicates the old menuCategory paddingHorizontal for category-scoped rows.
  categoryRowPad: {
    paddingHorizontal: spacing.lg,
  },
  // Category header: the same horizontal inset plus the old menuCategory paddingTop.
  categoryHeaderPad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  dishRow: {
    marginBottom: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkSecondary,
  },
  modifierWrap: {
    paddingHorizontal: spacing.md,
  },
});
