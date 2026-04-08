/**
 * Restaurant Detail Screen
 *
 * Modal-style screen displaying restaurant menu
 * Similar to DailyFilterModal design with compact header
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackScreenProps } from '@/types/navigation';
import {
  supabase,
  type RestaurantWithMenus,
  type Dish,
  type OptionGroup,
  type Option,
} from '../lib/supabase';
import { restaurantDetailStyles as styles } from '@/styles';
import { colors, spacing, typography } from '@/styles/theme';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useTranslation } from 'react-i18next';
import { formatTime, formatOpeningHours, isRestaurantOpenNow } from '../utils/i18nUtils';
import { toggleFavorite, isFavorited } from '../services/favoritesService';
import { DishPhotoModal } from '../components/DishPhotoModal';
import { DishRatingBadge } from '../components/DishRatingBadge';
import { getDishRatingsBatch, type DishRating } from '../services/dishRatingService';
import { RestaurantRatingBadge } from '../components/RestaurantRatingBadge';
import { getRestaurantRating, type RestaurantRating } from '../services/restaurantRatingService';
import { useFilterStore } from '../stores/filterStore';
import { useRestaurantStore } from '../stores/restaurantStore';
import { classifyDish, sortDishesByFilter, ALLERGY_TO_DB } from '../utils/menuFilterUtils';
import { recordInteraction } from '../services/interactionService';

type Props = RootStackScreenProps<'RestaurantDetail'>;

export function RestaurantDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { restaurantId } = route.params;
  const user = useAuthStore(state => state.user);
  const trackRestaurantView = useSessionStore(state => state.trackRestaurantView);
  const trackDishView = useSessionStore(state => state.trackDishView);
  const fetchRestaurantDetail = useRestaurantStore(state => state.fetchRestaurantDetail);
  const fetchCategoryDishes = useRestaurantStore(state => state.fetchCategoryDishes);
  const permanentFilters = useFilterStore(state => state.permanent);
  const ingredientsToAvoid = useFilterStore(state => state.permanent.ingredientsToAvoid);
  const [restaurant, setRestaurant] = useState<RestaurantWithMenus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'food' | 'hours'>('food');
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoritesInitialized, setFavoritesInitialized] = useState(false);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [dishOptionGroups, setDishOptionGroups] = useState<OptionGroup[]>([]);
  const [dishPhotos, setDishPhotos] = useState<
    Array<{
      id: string;
      photo_url: string;
      user_id: string;
      created_at: string;
      dish_id: string;
    }>
  >([]);
  const [dishIngredientNames, setDishIngredientNames] = useState<string[]>([]);
  const [dishRatings, setDishRatings] = useState<Map<string, DishRating>>(new Map());
  const [restaurantRating, setRestaurantRating] = useState<RestaurantRating | null>(null);
  // Per-category dish loading state: Map<categoryId, 'loading' | 'error' | Dish[]>
  const [categoryDishes, setCategoryDishes] = useState<Map<string, 'loading' | 'error' | Dish[]>>(
    new Map()
  );
  // Maps option.id → allergen codes that apply to that option's canonical ingredient.
  const [optionAllergens, setOptionAllergens] = useState<Map<string, string[]>>(new Map());

  // Single effect: restaurant data, restaurant rating and favourite check fire
  // in parallel via Promise.all; dish ratings follow immediately after the
  // restaurant payload arrives (they need dish IDs).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [restaurantResult, ratingResult, favResult] = await Promise.all([
          fetchRestaurantDetail(restaurantId),
          getRestaurantRating(restaurantId),
          user ? isFavorited(user.id, 'restaurant', restaurantId) : Promise.resolve(null),
        ]);

        if (!mountedRef.current) return;

        // Restaurant rating (independent of restaurant data)
        setRestaurantRating(ratingResult);

        // Favourite status
        if (favResult !== null) {
          setIsFavorite(favResult.ok ? favResult.data : false);
        }
        setFavoritesInitialized(true);

        // Restaurant data + dish ratings
        const { data, error } = restaurantResult;
        if (error) throw error;

        if (data) {
          const typed = data;
          setRestaurant(typed);

          trackRestaurantView({
            id: typed.id,
            name: typed.name,
            cuisine: typed.cuisine_types?.[0] || 'Restaurant',
            imageUrl: typed.image_url ?? undefined,
          });

          // Dish ratings are loaded per-category via loadCategoryDishes()
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    loadAll();
  }, [restaurantId, user, trackRestaurantView]);

  // Lazy-load dishes for a specific category; no-op if already loading or loaded
  const loadCategoryDishes = React.useCallback(
    async (categoryId: string) => {
      if (!mountedRef.current) return;
      setCategoryDishes(prev => {
        if (prev.has(categoryId)) return prev; // already loaded or loading
        const next = new Map(prev);
        next.set(categoryId, 'loading');
        return next;
      });
      const { data, error } = await fetchCategoryDishes(categoryId);
      if (!mountedRef.current) return;
      if (error || !data) {
        setCategoryDishes(prev => {
          const next = new Map(prev);
          next.set(categoryId, 'error');
          return next;
        });
        return;
      }
      setCategoryDishes(prev => {
        const next = new Map(prev);
        next.set(categoryId, data);
        return next;
      });
      // Load dish ratings for newly fetched dishes
      const dishIds = data.map(d => d.id);
      if (dishIds.length > 0) {
        const ratings = await getDishRatingsBatch(dishIds);
        if (mountedRef.current) {
          setDishRatings(prev => new Map([...prev, ...ratings]));
        }
      }
    },
    [fetchCategoryDishes]
  );

  // Auto-load all categories in parallel when restaurant metadata arrives
  useEffect(() => {
    if (!restaurant) return;
    restaurant.menus?.forEach(menu =>
      menu.menu_categories?.forEach(cat => {
        if (cat?.id) loadCategoryDishes(cat.id);
      })
    );
  }, [restaurant?.id]);

  // Record 'viewed' interaction after the dish detail has been open for 3+ seconds.
  // Timer is cleared if the user dismisses before 3s.
  useEffect(() => {
    if (!selectedDish || !user) return;
    const timer = setTimeout(() => {
      recordInteraction(user.id, selectedDish.id, 'viewed');
    }, 3000);
    return () => clearTimeout(timer);
  }, [selectedDish?.id, user?.id]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: spacing.base, color: colors.textSecondary }}>
          {t('restaurant.loadingRestaurant')}
        </Text>
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('restaurant.restaurantNotFound')}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Adapt Supabase data to match expected format
  const getCurrentDayHours = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    const hours = restaurant.open_hours as Record<string, { open: string; close: string }> | null;
    return hours?.[today] || null;
  };

  const getCurrentDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const todayHours = getCurrentDayHours();
  const isOpenNow =
    todayHours !== null &&
    isRestaurantOpenNow(
      restaurant.open_hours as Record<string, { open: string; close: string }> | null
    );

  // Determine payment note from DB column
  const getPaymentNote = () => {
    switch (restaurant.payment_methods) {
      case 'cash_only':
        return { icon: '💵', label: 'Cash only' };
      case 'card_only':
        return { icon: '💳', label: 'Cards only' };
      case 'cash_and_card':
        return { icon: '💵💳', label: 'Cash & card' };
      default:
        return null;
    }
  };
  const paymentNote = getPaymentNote();

  const handleMenuOption = async (option: string) => {
    switch (option) {
      case 'address':
        // Show custom address modal with dark theme
        setShowAddressModal(true);
        break;
      case 'favorites':
        if (!user) {
          Alert.alert(t('common.signInRequired'), t('favorites.signInToAdd'));
          return;
        }
        setFavoriteLoading(true);
        try {
          const result = await toggleFavorite(user.id, 'restaurant', restaurantId);
          if (!result.ok) {
            Alert.alert(t('common.error'), t('favorites.updateFailed'));
          } else {
            setIsFavorite(result.data);
            Alert.alert(
              t('common.success'),
              result.data ? t('favorites.addedToFavorites') : t('favorites.removedFromFavorites')
            );
          }
        } catch (err) {
          console.error('[Favorites] Error:', err);
          Alert.alert(t('common.error'), t('favorites.updateFailed'));
        } finally {
          setFavoriteLoading(false);
        }
        break;
      case 'review':
        Alert.alert(t('restaurantDetail.addReview'), t('restaurantDetail.reviewComingSoon'));
        break;
      case 'share':
        Alert.alert(t('restaurant.share'), t('restaurantDetail.shareComingSoon'));
        break;
      case 'call':
        if (restaurant.phone) {
          const phoneUrl = `tel:${restaurant.phone}`;
          Linking.openURL(phoneUrl).catch(err => {
            console.error('Failed to make call:', err);
            Alert.alert(t('common.error'), t('restaurantDetail.phoneDialerFailed'));
          });
        } else {
          Alert.alert(t('restaurantDetail.noPhone'), t('restaurantDetail.phoneNotAvailable'));
        }
        break;
      case 'report':
        Alert.alert(t('restaurant.report'), t('restaurantDetail.reportComingSoon'));
        break;
    }
  };

  /**
   * DishWithGroups augments the generated Dish type with:
   * - option_groups: embedded option groups from the nested query
   * - photo_url: legacy alias for image_url (may be present from older data/queries)
   * - ingredients: legacy text array column (superseded by dish_ingredients join table)
   * - parent_dish_id / is_parent: universal dish structure fields
   */
  type DishWithGroups = Dish & {
    option_groups?: OptionGroup[];
    photo_url?: string | null;
    ingredients?: string[];
    parent_dish_id?: string | null;
    is_parent?: boolean;
  };

  /**
   * Groups dishes within a category by parent_dish_id.
   * Returns an ordered list of render items:
   *   - ParentGroup: parent dish + its variant children
   *   - standalone: dishes with no parent and is_parent=false
   * Parent display-only containers without variants are omitted.
   */
  function groupDishesByParent(
    dishes: DishWithGroups[]
  ): Array<
    | { type: 'standalone'; dish: DishWithGroups }
    | { type: 'parent'; parent: DishWithGroups; variants: DishWithGroups[] }
  > {
    const parentMap = new Map<string, DishWithGroups>();
    const variantsByParent = new Map<string, DishWithGroups[]>();
    const standalones: DishWithGroups[] = [];

    for (const dish of dishes) {
      if (dish.is_parent) {
        parentMap.set(dish.id, dish);
        if (!variantsByParent.has(dish.id)) variantsByParent.set(dish.id, []);
      } else if (dish.parent_dish_id) {
        const list = variantsByParent.get(dish.parent_dish_id) ?? [];
        list.push(dish);
        variantsByParent.set(dish.parent_dish_id, list);
      } else {
        standalones.push(dish);
      }
    }

    const result: ReturnType<typeof groupDishesByParent> = [];

    // Walk original dish order to preserve restaurant-defined ordering
    for (const dish of dishes) {
      if (dish.is_parent) {
        const variants = variantsByParent.get(dish.id) ?? [];
        if (variants.length > 0) {
          result.push({ type: 'parent', parent: dish, variants });
        }
        // Skip parent with no variants (shouldn't happen in practice)
      } else if (!dish.parent_dish_id) {
        result.push({ type: 'standalone', dish });
      }
      // Variants are rendered inside their parent group, skip here
    }

    return result;
  }

  const handleDishPress = async (dish: DishWithGroups) => {
    setSelectedDish(dish);
    // Option groups are already embedded in the dish from the query
    const embedded: OptionGroup[] = (dish.option_groups ?? [])
      .filter((g: OptionGroup) => g.is_active)
      .sort((a: OptionGroup, b: OptionGroup) => a.display_order - b.display_order)
      .map((g: OptionGroup) => ({
        ...g,
        options: (g.options ?? [])
          .filter((o: Option) => o.is_available)
          .sort((a: Option, b: Option) => a.display_order - b.display_order),
      }));
    setDishOptionGroups(embedded);

    // Reset option allergens when opening a new dish
    setOptionAllergens(new Map());

    // Collect option IDs that have a canonical_ingredient_id set
    const optionsWithIngredient: { optionId: string; ingredientId: string }[] = [];
    for (const group of embedded) {
      for (const opt of group.options) {
        if (opt.canonical_ingredient_id) {
          optionsWithIngredient.push({
            optionId: opt.id,
            ingredientId: opt.canonical_ingredient_id,
          });
        }
      }
    }
    trackDishView(restaurantId, {
      id: dish.id,
      name: dish.name,
      price: dish.price,
      imageUrl: dish.photo_url ?? undefined,
    });

    // Fetch photos, ingredients, and option allergens in parallel
    const [photosResult, ingredientsResult, allergenResult] = await Promise.allSettled([
      supabase
        .from('dish_photos')
        .select('*')
        .eq('dish_id', dish.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('dish_ingredients')
        .select('canonical_ingredient:canonical_ingredients(canonical_name)')
        .eq('dish_id', dish.id),
      optionsWithIngredient.length > 0
        ? supabase
            .from('canonical_ingredient_allergens')
            .select('canonical_ingredient_id, allergen_code')
            .in(
              'canonical_ingredient_id',
              optionsWithIngredient.map(o => o.ingredientId)
            )
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Photos
    if (photosResult.status === 'fulfilled') {
      const { data, error } = photosResult.value;
      if (error) {
        console.error('Error fetching dish photos:', error);
        setDishPhotos([]);
      } else {
        setDishPhotos(
          (data || []).map(row => ({
            ...row,
            created_at: row.created_at ?? '',
            updated_at: row.updated_at ?? '',
          }))
        );
      }
    } else {
      setDishPhotos([]);
    }

    // Ingredients from junction table (canonical names)
    if (ingredientsResult.status === 'fulfilled') {
      const { data, error } = ingredientsResult.value;
      if (!error && data && data.length > 0) {
        const names = data
          .map(
            (row: { canonical_ingredient: { canonical_name: string } | null }) =>
              row.canonical_ingredient?.canonical_name
          )
          .filter(Boolean) as string[];
        setDishIngredientNames(names);
      } else {
        // Fall back to legacy ingredients text array if junction table is empty
        setDishIngredientNames(dish.ingredients || []);
      }
    } else {
      setDishIngredientNames(dish.ingredients || []);
    }

    // Build option allergen map: option.id → allergen_code[]
    if (allergenResult.status === 'fulfilled') {
      const { data } = allergenResult.value as {
        data: { canonical_ingredient_id: string; allergen_code: string }[] | null;
        error: { message: string } | null;
      };
      if (data && data.length > 0) {
        // ingredient_id → allergen_codes[]
        const byIngredient = new Map<string, string[]>();
        for (const row of data) {
          const existing = byIngredient.get(row.canonical_ingredient_id) ?? [];
          existing.push(row.allergen_code);
          byIngredient.set(row.canonical_ingredient_id, existing);
        }
        // option.id → allergen_codes[] (via canonical_ingredient_id)
        const map = new Map<string, string[]>();
        for (const { optionId, ingredientId } of optionsWithIngredient) {
          const codes = byIngredient.get(ingredientId);
          if (codes && codes.length > 0) map.set(optionId, codes);
        }
        if (mountedRef.current) setOptionAllergens(map);
      }
    }
  };

  const renderMenuItem = (item: DishWithGroups) => {
    const rating = dishRatings.get(item.id);
    const pricePrefix = item.display_price_prefix;
    let priceLabel: string;
    switch (pricePrefix) {
      case 'from':
        priceLabel = `from $${item.price.toFixed(2)}`;
        break;
      case 'per_person':
        priceLabel = `$${item.price.toFixed(2)}/person`;
        break;
      case 'market_price':
        priceLabel = 'Market price';
        break;
      case 'ask_server':
        priceLabel = 'Ask server';
        break;
      default:
        priceLabel = `$${item.price.toFixed(2)}`;
    }

    const { passesHardFilters, flaggedIngredientNames } = classifyDish(
      item,
      permanentFilters,
      ingredientsToAvoid
    );

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.menuItem, !passesHardFilters && { opacity: 0.35 }]}
        onPress={() => handleDishPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemHeader}>
          <View style={styles.menuItemNameContainer}>
            <Text style={styles.menuItemName}>
              {item.name}
              {item.dietary_tags?.includes('vegan') && ' 🌱'}
              {item.dietary_tags?.includes('vegetarian') &&
                !item.dietary_tags?.includes('vegan') &&
                ' 🥬'}
            </Text>
            {!passesHardFilters && (
              <View style={styles.notForYouPill}>
                <Text style={styles.notForYouText}>Not for you</Text>
              </View>
            )}
            {rating && (
              <DishRatingBadge
                likePercentage={rating.likePercentage}
                totalRatings={rating.totalRatings}
                topTags={rating.topTags}
              />
            )}
          </View>
          <Text style={styles.menuItemPrice}>{priceLabel}</Text>
        </View>
        {item.description && item.description_visibility !== 'detail' && (
          <Text style={styles.menuItemIngredients}>{item.description}</Text>
        )}
        {item.ingredients_visibility === 'menu' && (item.ingredients?.length ?? 0) > 0 && (
          <Text style={styles.menuItemIngredients}>{item.ingredients!.join(', ')}</Text>
        )}
        {flaggedIngredientNames.length > 0 && (
          <Text style={styles.flaggedIngredientsWarning}>
            ⚠️ Contains: {flaggedIngredientNames.join(', ')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  /**
   * Returns dishes sorted so those passing hard filters appear first.
   * Preserves the restaurant-defined order within each group.
   */
  const sortedDishes = (dishes: DishWithGroups[]): DishWithGroups[] => {
    const classified = dishes.map(d => ({
      ...d,
      passesHardFilters: classifyDish(d, permanentFilters, ingredientsToAvoid).passesHardFilters,
    }));
    return sortDishesByFilter(classified);
  };

  return (
    <View style={styles.container}>
      {/* Compact Header */}
      <View style={[styles.header, insets.top > 0 && { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerContent}>
          {/* Restaurant Name and Rating on same row */}
          <View style={styles.nameRatingRow}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {restaurant.name}
            </Text>
            {/* Use live community rating from restaurant_ratings_summary.
                Falls back to the restaurants.rating column (updated by trigger)
                once opinions exist; shows nothing while unrated. */}
            {(restaurantRating?.overallPercentage ?? 0) > 0 && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>
                  ⭐ {(restaurantRating!.overallPercentage / 20).toFixed(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Restaurant Rating Badges - Right below name */}
          <RestaurantRatingBadge rating={restaurantRating} showBreakdown={true} />

          {/* Cuisine Type */}
          <Text style={styles.cuisineText}>{restaurant.cuisine_types?.join(', ') || ''}</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'food' && styles.activeTab]}
          onPress={() => setActiveTab('food')}
        >
          <Text style={[styles.tabText, activeTab === 'food' && styles.activeTabText]}>
            Food & Drinks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hours' && styles.activeTab]}
          onPress={() => setActiveTab('hours')}
        >
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabText, activeTab === 'hours' && styles.activeTabText]}>
              Hours & More
            </Text>
            <Text style={isOpenNow ? styles.tabOpenBadge : styles.tabClosedBadge}>
              {isOpenNow ? 'Open' : 'Closed'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Food & Drinks Tab */}
      {activeTab === 'food' && (
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
                const grouped = groupDishesByParent(sortedDishes(dishes));
                return (
                  <View key={category.id} style={styles.menuCategory}>
                    <TouchableOpacity
                      onPress={() => loadCategoryDishes(category.id)}
                      activeOpacity={1}
                    >
                      <Text style={styles.categoryName}>{category.name}</Text>
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
                          return renderMenuItem(item.dish);
                        }
                        // Parent group: render parent name as sub-header, then variants
                        return (
                          <View key={item.parent.id}>
                            <Text
                              style={[
                                styles.menuItemName,
                                {
                                  marginTop: 8,
                                  marginBottom: 2,
                                  opacity: 0.6,
                                  fontStyle: 'italic',
                                },
                              ]}
                            >
                              {item.parent.name}
                              {item.parent.description ? ` — ${item.parent.description}` : ''}
                            </Text>
                            {item.variants.map(variant => renderMenuItem(variant))}
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
        </ScrollView>
      )}

      {/* Hours & More Tab */}
      {activeTab === 'hours' && (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={[styles.hoursTabContent, { paddingBottom: insets.bottom + 24 }]}
        >
          {/* Opening Hours Section */}
          <View style={styles.hoursMoreSection}>
            <Text style={styles.hoursMoreSectionTitle}>{t('time.openingHours')}</Text>

            {/* Today's hours — always visible, with expand arrow on the right */}
            <TouchableOpacity
              style={styles.weekDayRow}
              onPress={() => setHoursExpanded(!hoursExpanded)}
              activeOpacity={0.7}
            >
              <Text style={[styles.weekDayName, { fontWeight: typography.weight.bold }]}>
                {t(`time.${getCurrentDayName().toLowerCase()}`)}
              </Text>
              {todayHours ? (
                <Text style={[styles.weekDayHours, { flex: 1 }]}>
                  {formatOpeningHours(todayHours.open, todayHours.close)}
                </Text>
              ) : (
                <Text style={[styles.weekDayHoursClosed, { flex: 1 }]}>
                  {t('restaurant.closed')}
                </Text>
              )}
              <Text style={styles.hoursExpandIcon}>{hoursExpanded ? '▴' : '▾'}</Text>
            </TouchableOpacity>
            {hoursExpanded && (
              <View style={styles.fullWeekHours}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                  .filter(day => day !== getCurrentDayName().toLowerCase())
                  .map(day => {
                    const hours = (
                      restaurant.open_hours as Record<
                        string,
                        { open: string; close: string }
                      > | null
                    )?.[day];
                    return (
                      <View key={day} style={styles.weekDayRow}>
                        <Text style={styles.weekDayName}>{t(`time.${day}`)}</Text>
                        {hours ? (
                          <Text style={styles.weekDayHours}>
                            {formatOpeningHours(hours.open, hours.close)}
                          </Text>
                        ) : (
                          <Text style={styles.weekDayHoursClosed}>{t('restaurant.closed')}</Text>
                        )}
                      </View>
                    );
                  })}
              </View>
            )}
          </View>

          {/* Payment Methods Section */}
          {paymentNote && (
            <View style={styles.hoursMoreSection}>
              <Text style={styles.hoursMoreSectionTitle}>{t('restaurant.payment')}</Text>
              <Text style={styles.hoursMoreAddress}>
                {paymentNote.icon}
                {'  '}
                {paymentNote.label}
              </Text>
            </View>
          )}

          {/* Address Section */}
          <View style={styles.hoursMoreSection}>
            <Text style={styles.hoursMoreSectionTitle}>{t('settings.address')}</Text>
            <Text style={styles.hoursMoreAddress}>
              {restaurant.address}
              {'\n'}
              {restaurant.city}
              {restaurant.postal_code ? `, ${restaurant.postal_code}` : ''}
            </Text>
            <TouchableOpacity
              style={styles.hoursMoreActionButton}
              onPress={() => setShowAddressModal(true)}
            >
              <Text style={styles.hoursMoreActionButtonText}>📍 {t('restaurant.openInMaps')}</Text>
            </TouchableOpacity>
          </View>

          {/* More Actions Section */}
          <View style={styles.hoursMoreSection}>
            <Text style={styles.hoursMoreSectionTitle}>{t('restaurant.more')}</Text>

            <TouchableOpacity
              style={styles.hoursMoreRow}
              onPress={() => handleMenuOption('favorites')}
              disabled={favoriteLoading || !favoritesInitialized}
            >
              <Text style={styles.hoursMoreRowIcon}>⭐</Text>
              <Text style={styles.hoursMoreRowText}>
                {!favoritesInitialized
                  ? t('common.loading')
                  : favoriteLoading
                    ? t('common.updating')
                    : isFavorite
                      ? t('restaurant.removeFromFavorites')
                      : t('restaurant.addToFavorites')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hoursMoreRow}
              onPress={() => handleMenuOption('review')}
            >
              <Text style={styles.hoursMoreRowIcon}>✍️</Text>
              <Text style={styles.hoursMoreRowText}>{t('restaurantDetail.addReview')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hoursMoreRow} onPress={() => handleMenuOption('share')}>
              <Text style={styles.hoursMoreRowIcon}>↗️</Text>
              <Text style={styles.hoursMoreRowText}>{t('restaurant.share')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.hoursMoreRow} onPress={() => handleMenuOption('call')}>
              <Text style={styles.hoursMoreRowIcon}>📞</Text>
              <Text style={styles.hoursMoreRowText}>{t('restaurant.call')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hoursMoreRow, styles.hoursMoreRowLast]}
              onPress={() => handleMenuOption('report')}
            >
              <Text style={styles.hoursMoreRowIcon}>🚩</Text>
              <Text style={[styles.hoursMoreRowText, styles.hoursMoreRowTextDanger]}>
                {t('restaurant.reportMisleadingInfo')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Address Modal */}
      <Modal
        visible={showAddressModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <TouchableOpacity
          style={styles.addressModalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddressModal(false)}
        >
          <View style={styles.addressModal}>
            <Text style={styles.addressModalTitle}>{t('restaurant.restaurantAddress')}</Text>
            <Text style={styles.addressModalText}>
              {restaurant.address}
              {'\n'}
              {restaurant.city}, {restaurant.postal_code}
            </Text>
            <View style={styles.addressModalButtons}>
              <TouchableOpacity
                style={[styles.addressModalButton, styles.addressModalButtonPrimary]}
                onPress={() => {
                  const address = `${restaurant.address}, ${restaurant.city}, ${restaurant.postal_code}`;
                  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    address
                  )}`;
                  Linking.openURL(url).catch(err => {
                    console.error('Failed to open maps:', err);
                    Alert.alert(t('common.error'), 'Failed to open maps');
                  });
                  setShowAddressModal(false);
                }}
              >
                <Text style={styles.addressModalButtonText}>{t('restaurant.openInMaps')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addressModalButton}
                onPress={() => setShowAddressModal(false)}
              >
                <Text
                  style={[styles.addressModalButtonText, styles.addressModalButtonTextSecondary]}
                >
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Dish Photo Modal */}
      {selectedDish && (
        <DishPhotoModal
          visible={!!selectedDish}
          onClose={() => {
            setSelectedDish(null);
            setDishPhotos([]);
            setDishIngredientNames([]);
            setDishOptionGroups([]);
            setOptionAllergens(new Map());
          }}
          dishId={selectedDish.id}
          dishName={selectedDish.name}
          dishDescription={
            selectedDish.description_visibility !== 'menu'
              ? (selectedDish.description ?? undefined)
              : undefined
          }
          dishIngredients={
            selectedDish.ingredients_visibility === 'detail' ? dishIngredientNames : []
          }
          dishPrice={selectedDish.price}
          dishKind={selectedDish.dish_kind ?? 'standard'}
          displayPricePrefix={selectedDish.display_price_prefix ?? 'exact'}
          optionGroups={dishOptionGroups}
          optionAllergens={optionAllergens}
          userAllergens={(
            Object.entries(permanentFilters.allergies) as [
              keyof typeof permanentFilters.allergies,
              boolean,
            ][]
          )
            .filter(([, v]) => v)
            .map(([k]) => ALLERGY_TO_DB[k])}
          photos={dishPhotos}
          onPhotoAdded={() => {
            // Refresh photos after upload
            if (selectedDish) {
              handleDishPress(selectedDish);
            }
          }}
        />
      )}
    </View>
  );
}
