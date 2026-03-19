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
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackScreenProps } from '@/types/navigation';
import { supabase, type RestaurantWithMenus, type Dish, type OptionGroup } from '../lib/supabase';
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

type Props = RootStackScreenProps<'RestaurantDetail'>;

export function RestaurantDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { restaurantId } = route.params;
  const user = useAuthStore(state => state.user);
  const trackRestaurantView = useSessionStore(state => state.trackRestaurantView);
  const trackDishView = useSessionStore(state => state.trackDishView);
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
  const [dishPhotos, setDishPhotos] = useState<any[]>([]);
  const [dishIngredientNames, setDishIngredientNames] = useState<string[]>([]);
  const [dishRatings, setDishRatings] = useState<Map<string, DishRating>>(new Map());
  const [restaurantRating, setRestaurantRating] = useState<RestaurantRating | null>(null);

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
          supabase
            .from('restaurants')
            .select(
              `
              *,
              menus (
                *,
                menu_categories (
                  *,
                  dishes (
                    *,
                    option_groups (
                      *,
                      options (*)
                    )
                  )
                )
              )
            `
            )
            .eq('id', restaurantId)
            .single(),
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
          const typed = data as unknown as RestaurantWithMenus;
          setRestaurant(typed);

          trackRestaurantView({
            id: typed.id,
            name: typed.name,
            cuisine: typed.cuisine_types?.[0] || 'Restaurant',
            imageUrl: typed.image_url ?? undefined,
          });

          // Dish ratings need restaurant data first — fire immediately after
          const allDishIds =
            typed.menus?.flatMap(
              m => m.menu_categories?.flatMap(c => c.dishes?.map(d => d.id) ?? []) ?? []
            ) ?? [];

          if (allDishIds.length > 0) {
            const ratings = await getDishRatingsBatch(allDishIds);
            if (mountedRef.current) setDishRatings(ratings);
          }
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    loadAll();
  }, [restaurantId, user, trackRestaurantView]);

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
    switch ((restaurant as any).payment_methods) {
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

  const handleDishPress = async (dish: any) => {
    setSelectedDish(dish);
    // Option groups are already embedded in the dish from the query
    const embedded: OptionGroup[] = (dish.option_groups ?? [])
      .filter((g: OptionGroup) => g.is_active)
      .sort((a: OptionGroup, b: OptionGroup) => a.display_order - b.display_order)
      .map((g: OptionGroup) => ({
        ...g,
        options: (g.options ?? [])
          .filter((o: any) => o.is_available)
          .sort((a: any, b: any) => a.display_order - b.display_order),
      }));
    setDishOptionGroups(embedded);

    // Track dish view
    trackDishView(restaurantId, {
      id: dish.id,
      name: dish.name,
      price: dish.price,
      imageUrl: dish.photo_url,
    });

    // Fetch photos and ingredients in parallel
    const [photosResult, ingredientsResult] = await Promise.allSettled([
      supabase
        .from('dish_photos')
        .select('*')
        .eq('dish_id', dish.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('dish_ingredients')
        .select('canonical_ingredient:canonical_ingredients(canonical_name)')
        .eq('dish_id', dish.id),
    ]);

    // Photos
    if (photosResult.status === 'fulfilled') {
      const { data, error } = photosResult.value;
      if (error) {
        console.error('Error fetching dish photos:', error);
        setDishPhotos([]);
      } else {
        setDishPhotos(data || []);
      }
    } else {
      setDishPhotos([]);
    }

    // Ingredients from junction table (canonical names)
    if (ingredientsResult.status === 'fulfilled') {
      const { data, error } = ingredientsResult.value;
      if (!error && data && data.length > 0) {
        const names = data
          .map((row: any) => row.canonical_ingredient?.canonical_name)
          .filter(Boolean) as string[];
        setDishIngredientNames(names);
      } else {
        // Fall back to legacy ingredients text array if junction table is empty
        setDishIngredientNames(dish.ingredients || []);
      }
    } else {
      setDishIngredientNames(dish.ingredients || []);
    }
  };

  const renderMenuItem = (item: any) => {
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

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.menuItem}
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
        {item.ingredients_visibility === 'menu' && item.ingredients?.length > 0 && (
          <Text style={styles.menuItemIngredients}>{item.ingredients.join(', ')}</Text>
        )}
      </TouchableOpacity>
    );
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
          contentContainerStyle={styles.scrollContent}
        >
          {restaurant.menus?.map((menu: any) => (
            <View key={menu.id} style={styles.menuSection}>
              <Text style={styles.menuName}>{menu.name}</Text>
              {menu.description && <Text style={styles.menuDescription}>{menu.description}</Text>}
              {menu.menu_categories?.map((category: any) => (
                <View key={category.id} style={styles.menuCategory}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  {category.dishes?.map(renderMenuItem)}
                </View>
              ))}
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
          contentContainerStyle={styles.hoursTabContent}
        >
          {/* Opening Hours Section */}
          <View style={styles.hoursMoreSection}>
            <TouchableOpacity
              style={styles.hoursMoreTitleRow}
              onPress={() => setHoursExpanded(!hoursExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.hoursMoreSectionTitle}>{t('time.openingHours')}</Text>
              <Text style={styles.hoursExpandIcon}>{hoursExpanded ? '▾' : '▸'}</Text>
            </TouchableOpacity>
            {hoursExpanded && (
              <View style={styles.fullWeekHours}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(
                  day => {
                    const hours = (
                      restaurant.open_hours as Record<
                        string,
                        { open: string; close: string }
                      > | null
                    )?.[day];
                    const isToday = day === getCurrentDayName().toLowerCase();
                    return (
                      <View key={day} style={styles.weekDayRow}>
                        <Text style={[styles.weekDayName, isToday && styles.weekDayNameToday]}>
                          {t(`time.${day}`)}
                        </Text>
                        {hours ? (
                          <Text style={styles.weekDayHours}>
                            {formatOpeningHours(hours.open, hours.close)}
                          </Text>
                        ) : (
                          <Text style={styles.weekDayHoursClosed}>{t('restaurant.closed')}</Text>
                        )}
                      </View>
                    );
                  }
                )}
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
          dishKind={(selectedDish as any).dish_kind ?? 'standard'}
          displayPricePrefix={(selectedDish as any).display_price_prefix ?? 'exact'}
          optionGroups={dishOptionGroups}
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
