/**
 * FoodTab
 *
 * Renders the "Food & Drinks" tab content: the full list of menus,
 * their categories, and lazy-loaded dish rows (with parent/variant grouping).
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { restaurantDetailStyles as styles } from '@/styles';
import { colors, spacing } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { type RestaurantWithMenus, type MenuCategoryWithCanonical } from '../../lib/supabase';
import { type PermanentFilters, type IngredientToAvoid } from '../../stores/filterStore';
import { type DishRating } from '../../services/dishRatingService';
import { groupDishesByParent, type DishWithGroups } from './DishGrouping';
import { classifyDish, sortDishesByFilter } from '../../utils/menuFilterUtils';
import { DishMenuItem } from './DishMenuItem';
import { VariantPickerSheet } from './VariantPickerSheet';

interface FoodTabProps {
  restaurant: RestaurantWithMenus;
  categoryDishes: Map<string, DishWithGroups[] | 'loading' | 'error'>;
  dishRatings: Map<string, DishRating>;
  permanentFilters: PermanentFilters;
  ingredientsToAvoid: IngredientToAvoid[];
  loadCategoryDishes: (categoryId: string) => void;
  onDishPress: (dish: DishWithGroups) => void;
}

function sortedDishes(
  dishes: DishWithGroups[],
  permanentFilters: PermanentFilters,
  ingredientsToAvoid: IngredientToAvoid[]
): DishWithGroups[] {
  const classified = dishes.map(d => ({
    ...d,
    passesHardFilters: classifyDish(d, permanentFilters, ingredientsToAvoid).passesHardFilters,
  }));
  return sortDishesByFilter(classified);
}

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

export function FoodTab({
  restaurant,
  categoryDishes,
  dishRatings,
  permanentFilters,
  ingredientsToAvoid,
  loadCategoryDishes,
  onDishPress,
}: FoodTabProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const locale = i18n.language;

  const [pickerGroup, setPickerGroup] = useState<{
    parent: DishWithGroups;
    variants: DishWithGroups[];
  } | null>(null);

  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
      nestedScrollEnabled
    >
      {restaurant.menus?.map(menu => (
        <View key={menu.id} style={styles.menuSection}>
          <Text style={styles.menuName}>{menu.name}</Text>
          {menu.description && <Text style={styles.menuDescription}>{menu.description}</Text>}
          {menu.menu_categories?.map(category => {
            const categoryState = categoryDishes.get(category.id);
            const dishes = Array.isArray(categoryState) ? categoryState : [];
            const grouped = groupDishesByParent(
              sortedDishes(dishes as DishWithGroups[], permanentFilters, ingredientsToAvoid)
            );
            return (
              <View key={category.id} style={styles.menuCategory}>
                <TouchableOpacity onPress={() => loadCategoryDishes(category.id)} activeOpacity={1}>
                  <Text style={styles.categoryName}>{resolveCategoryName(category, locale)}</Text>
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
                  grouped.map(item => {
                    if (item.type === 'standalone') {
                      return (
                        <DishMenuItem
                          key={item.dish.id}
                          item={item.dish}
                          permanentFilters={permanentFilters}
                          ingredientsToAvoid={ingredientsToAvoid}
                          dishRatings={dishRatings}
                          onPress={onDishPress}
                        />
                      );
                    }
                    const minPrice = item.variants.reduce(
                      (acc, v) => (v.price != null && v.price < acc ? v.price : acc),
                      Infinity
                    );
                    return (
                      <View key={item.parent.id}>
                        <TouchableOpacity
                          onPress={() =>
                            setPickerGroup({ parent: item.parent, variants: item.variants })
                          }
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingVertical: 8,
                          }}
                        >
                          <Text
                            style={[styles.menuItemName, { fontStyle: 'italic', flex: 1 }]}
                            numberOfLines={2}
                          >
                            {item.parent.name}
                            {item.parent.description ? ` — ${item.parent.description}` : ''}
                          </Text>
                          {Number.isFinite(minPrice) && (
                            <Text
                              style={[styles.menuItemName, { color: colors.accent, marginLeft: 8 }]}
                            >
                              {t('restaurant.fromPrice', 'from ${{price}}', {
                                price: minPrice.toFixed(2),
                              })}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
              </View>
            );
          })}
        </View>
      ))}
      {(!restaurant.menus || restaurant.menus.length === 0) && (
        <View style={{ padding: spacing['2xl'], alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>{t('restaurant.noMenuItems')}</Text>
        </View>
      )}

      <VariantPickerSheet
        visible={pickerGroup !== null}
        parent={pickerGroup?.parent ?? null}
        variants={pickerGroup?.variants ?? []}
        onSelect={variant => {
          setPickerGroup(null);
          onDishPress(variant);
        }}
        onClose={() => setPickerGroup(null)}
      />
    </ScrollView>
  );
}
