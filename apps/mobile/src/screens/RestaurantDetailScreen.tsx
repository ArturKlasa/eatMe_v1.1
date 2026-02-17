/**
 * Restaurant Detail Screen
 *
 * Modal-style screen displaying restaurant menu
 * Similar to DailyFilterModal design with compact header
 */

import React, { useState, useEffect } from 'react';
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
import type { RootStackScreenProps } from '@/types/navigation';
import { supabase } from '../lib/supabase';
import { restaurantDetailStyles as styles } from '@/styles';
import { spacing } from '@/styles/theme';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useTranslation } from 'react-i18next';
import { formatTime, formatOpeningHours, getCurrentDayName } from '../utils/i18nUtils';
import { toggleFavorite, isFavorited } from '../services/favoritesService';
import { DishPhotoModal } from '../components/DishPhotoModal';
import { DishRatingBadge } from '../components/DishRatingBadge';
import { getDishRatingsBatch, type DishRating } from '../services/dishRatingService';
import { RestaurantRatingBadge } from '../components/RestaurantRatingBadge';
import { getRestaurantRating, type RestaurantRating } from '../services/restaurantRatingService';

type Props = RootStackScreenProps<'RestaurantDetail'>;

export function RestaurantDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { restaurantId } = route.params;
  const user = useAuthStore(state => state.user);
  const trackRestaurantView = useSessionStore(state => state.trackRestaurantView);
  const trackDishView = useSessionStore(state => state.trackDishView);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoritesInitialized, setFavoritesInitialized] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [selectedDish, setSelectedDish] = useState<any>(null);
  const [dishPhotos, setDishPhotos] = useState<any[]>([]);
  const [dishRatings, setDishRatings] = useState<Map<string, DishRating>>(new Map());
  const [restaurantRating, setRestaurantRating] = useState<RestaurantRating | null>(null);

  // Fetch restaurant from Supabase
  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select(
            `
            *,
            menus (
              *,
              menu_categories (
                *,
                dishes (*)
              )
            )
          `
          )
          .eq('id', restaurantId)
          .single();

        if (error) throw error;

        if (data) {
          setRestaurant(data);

          // Track restaurant view
          trackRestaurantView({
            id: data.id,
            name: data.name,
            cuisine: data.cuisine_types?.[0] || 'Restaurant',
            imageUrl: data.image_url,
          });

          // Fetch ratings for all dishes
          const allDishIds: string[] = [];
          data.menus?.forEach((menu: any) => {
            menu.menu_categories?.forEach((category: any) => {
              category.dishes?.forEach((dish: any) => {
                allDishIds.push(dish.id);
              });
            });
          });

          if (allDishIds.length > 0) {
            const ratings = await getDishRatingsBatch(allDishIds);
            setDishRatings(ratings);
          }
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [restaurantId, trackRestaurantView]);

  // Check if restaurant is favorited
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!user || !restaurantId) {
        setFavoritesInitialized(true);
        return;
      }

      const { isFavorited: favorited } = await isFavorited(user.id, 'restaurant', restaurantId);
      setIsFavorite(favorited);
      setFavoritesInitialized(true);
    };

    checkFavoriteStatus();
  }, [user, restaurantId]);

  // Fetch restaurant rating
  useEffect(() => {
    const fetchRestaurantRating = async () => {
      const rating = await getRestaurantRating(restaurantId);
      setRestaurantRating(rating);
    };

    fetchRestaurantRating();
  }, [restaurantId]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={{ marginTop: 16, color: '#666' }}>{t('restaurant.loadingRestaurant')}</Text>
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
    const hours = restaurant.operating_hours || restaurant.open_hours;
    return hours?.[today] || null;
  };

  const getCurrentDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const todayHours = getCurrentDayHours();
  const isOpenNow = true; // TODO: Calculate based on current time and hours

  // Determine payment note
  const getPaymentNote = () => {
    // For now, return null since payment methods aren't in Supabase yet
    return null;
  };

  const paymentNote = getPaymentNote();

  const handleMenuOption = async (option: string) => {
    setShowOptionsMenu(false);

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
          const { isFavorited: newStatus, error } = await toggleFavorite(
            user.id,
            'restaurant',
            restaurantId
          );
          if (error) {
            Alert.alert(t('common.error'), t('favorites.updateFailed'));
          } else {
            setIsFavorite(newStatus);
            Alert.alert(
              t('common.success'),
              newStatus ? t('favorites.addedToFavorites') : t('favorites.removedFromFavorites')
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

    // Track dish view
    trackDishView(restaurantId, {
      id: dish.id,
      name: dish.name,
      price: dish.price,
      imageUrl: dish.photo_url,
    });

    // Fetch photos for this dish
    try {
      const { data, error } = await supabase
        .from('dish_photos')
        .select('*')
        .eq('dish_id', dish.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching dish photos:', error);
        setDishPhotos([]);
      } else {
        setDishPhotos(data || []);
      }
    } catch (err) {
      console.error('Error fetching dish photos:', err);
      setDishPhotos([]);
    }
  };

  const renderMenuItem = (item: any) => {
    const rating = dishRatings.get(item.id);

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
          <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
        </View>
        {item.description && <Text style={styles.menuItemIngredients}>{item.description}</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Compact Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {/* Restaurant Name and Rating on same row */}
          <View style={styles.nameRatingRow}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {restaurant.name}
            </Text>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>
                ⭐ {restaurant.rating} ({restaurant.reviewCount})
              </Text>
            </View>
          </View>

          {/* Restaurant Rating Badges - Right below name */}
          <RestaurantRatingBadge rating={restaurantRating} showBreakdown={true} />

          {/* Cuisine Type */}
          <Text style={styles.cuisineText}>{restaurant.cuisine}</Text>

          {/* Opening Hours */}
          <View style={styles.hoursContainer}>
            <TouchableOpacity
              style={styles.hoursMainRow}
              onPress={() => setHoursExpanded(!hoursExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.currentDayInfo}>
                {todayHours ? (
                  <>
                    <Text style={styles.openBadge}>{t('restaurant.openNow')}</Text>
                    <Text style={styles.todayHoursText}>
                      {formatOpeningHours(todayHours.open, todayHours.close)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.closedBadge}>{t('restaurant.closed')}</Text>
                )}
              </View>
              <View style={styles.hoursRightSection}>
                <Text style={styles.expandIcon}>{hoursExpanded ? '▼' : '▶'}</Text>
              </View>
            </TouchableOpacity>

            {/* Full Week Hours - Collapsible */}
            {hoursExpanded && (
              <View style={styles.fullWeekHours}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(
                  day => {
                    const hours = (restaurant.operating_hours || restaurant.open_hours || {})[day];
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

          {/* Payment Row */}
          <View style={styles.hoursPaymentRow}></View>
        </View>

        {/* Three-dots menu button */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowOptionsMenu(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.menuButtonText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Content */}
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
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#666' }}>No menu items available</Text>
          </View>
        )}
      </ScrollView>

      {/* Options Menu Modal */}
      <Modal
        visible={showOptionsMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.optionsMenu}>
            <TouchableOpacity style={styles.optionItem} onPress={() => handleMenuOption('address')}>
              <Text style={styles.optionText}>Address</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => handleMenuOption('favorites')}
              disabled={favoriteLoading || !favoritesInitialized}
            >
              <Text style={styles.optionText}>
                {!favoritesInitialized
                  ? 'Loading...'
                  : favoriteLoading
                    ? 'Updating...'
                    : isFavorite
                      ? 'Remove from favorites ⭐'
                      : 'Add to favorites'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={() => handleMenuOption('review')}>
              <Text style={styles.optionText}>Add review</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={() => handleMenuOption('share')}>
              <Text style={styles.optionText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem} onPress={() => handleMenuOption('call')}>
              <Text style={styles.optionText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, styles.optionItemLast]}
              onPress={() => handleMenuOption('report')}
            >
              <Text style={styles.optionText}>Report misleading info</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
            <Text style={styles.addressModalTitle}>Restaurant Address</Text>
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
                    Alert.alert('Error', 'Failed to open maps');
                  });
                  setShowAddressModal(false);
                }}
              >
                <Text style={styles.addressModalButtonText}>Open in Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addressModalButton}
                onPress={() => setShowAddressModal(false)}
              >
                <Text
                  style={[styles.addressModalButtonText, styles.addressModalButtonTextSecondary]}
                >
                  Close
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
          }}
          dishId={selectedDish.id}
          dishName={selectedDish.name}
          dishDescription={selectedDish.description}
          dishPrice={selectedDish.price}
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
