/**
 * FoodTab
 *
 * Renders the "Food & Drinks" tab content: the full list of menus,
 * their categories, and lazy-loaded dish rows. Every dish renders through the
 * same standard row + inline modifier list.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
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

  // Multiple menus render collapsed by default (see the map below): the top of
  // the tab becomes a compact menu picker instead of every menu stacked open.
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const toggleMenu = (menuId: string) =>
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });

  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
      nestedScrollEnabled
    >
      {/* Featured dish — the one the user tapped to get here */}
      {featuredDish && (
        <View style={styles.featuredSection}>
          <Text style={styles.featuredLabel}>⭐ {t('restaurant.featuredFromSearch')}</Text>
          <DishMenuItem
            item={featuredDish}
            passesHardFilters={classifyDish(featuredDish, permanentFilters).passesHardFilters}
            rating={dishRatings.get(featuredDish.id) ?? null}
            currencyCode={restaurant.currency_code}
            userOpinion={userDishOpinions.get(featuredDish.id) ?? null}
            isFavorite={favoriteDishIds.has(featuredDish.id)}
            onPress={onDishPress}
          />
          {(featuredDish.option_groups?.length ?? 0) > 0 && (
            <View style={localStyles.modifierWrap}>
              <ModifierGroupsList
                groups={featuredDish.option_groups ?? []}
                daily={dailyFilters}
                basePrice={featuredDish.price ?? 0}
                currencyCode={restaurant.currency_code}
              />
            </View>
          )}
        </View>
      )}
      {restaurant.menus?.map(menu => {
        // Single menu → always expanded, no header (the food shows immediately).
        // Multiple menus → collapsible, collapsed by default, so the tab opens
        // as a compact picker the user expands one at a time.
        const expanded = singleMenu || expandedMenus.has(menu.id);
        return (
          <View key={menu.id} style={styles.menuSection}>
            {!singleMenu && (
              <TouchableOpacity
                style={styles.menuHeader}
                onPress={() => toggleMenu(menu.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuHeaderName} numberOfLines={1}>
                  {menu.name}
                </Text>
                <Text style={styles.menuChevron}>{expanded ? '▴' : '▾'}</Text>
              </TouchableOpacity>
            )}
            {expanded && !singleMenu && menu.description && (
              <Text style={styles.menuDescription}>{menu.description}</Text>
            )}
            {expanded &&
              menu.menu_categories?.map(category => {
                const categoryState = categoryDishes.get(category.id);
                const sorted = sortedByCategory.get(category.id) ?? [];
                return (
                  <View key={category.id} style={styles.menuCategory}>
                    <TouchableOpacity
                      style={styles.categoryHeader}
                      onPress={() => loadCategoryDishes(category.id)}
                      activeOpacity={1}
                    >
                      <Text style={styles.categoryName}>
                        {resolveCategoryName(category, locale)}
                      </Text>
                      {(() => {
                        const desc = resolveCategoryDescription(category, locale);
                        return desc ? <Text style={styles.categoryDescription}>{desc}</Text> : null;
                      })()}
                    </TouchableOpacity>
                    {categoryState === 'loading' && (
                      <ActivityIndicator
                        size="small"
                        color={colors.accent}
                        style={{ marginVertical: 8 }}
                      />
                    )}
                    {categoryState === 'error' && (
                      <Text style={{ color: colors.textSecondary, padding: 8 }}>
                        {t('common.error')}
                      </Text>
                    )}
                    {categoryState === undefined && (
                      <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={() => loadCategoryDishes(category.id)}
                      >
                        <Text style={{ color: colors.accent }}>
                          {t('restaurant.loadDishes', 'Load dishes')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {Array.isArray(categoryState) &&
                      sorted.map(dish => (
                        // Row + inline modifier groups below. option_groups[] is loaded by
                        // the bulk dish query. Empty array → ModifierGroupsList renders nothing.
                        <View key={dish.id} style={localStyles.dishRow}>
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
                      ))}
                  </View>
                );
              })}
          </View>
        );
      })}
      {(!restaurant.menus || restaurant.menus.length === 0) && (
        <View style={{ padding: spacing['2xl'], alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>{t('restaurant.noMenuItems')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
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
