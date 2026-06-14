/**
 * Restaurant Detail Screen
 *
 * Orchestrator component. All data-loading logic lives in useRestaurantDetail,
 * pure helper functions in RestaurantMetadata, and rendering in the
 * sub-components:
 *   - FoodTab         — Food & Drinks tab
 *   - HoursMoreTab    — Hours & More tab
 *   - AddressModal    — Address overlay modal
 *   - DishMenuItem    — Individual dish row (used inside FoodTab)
 */

import React from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackScreenProps } from '@/types/navigation';
import { restaurantDetailStyles as styles } from '@/styles';
import { colors, spacing } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { isRestaurantOpenNow } from '../../utils/i18nUtils';
import { DishPhotoModal } from '../../components/DishPhotoModal';
import { RestaurantRatingBadge } from '../../components/RestaurantRatingBadge';
import { toggleFavorite } from '../../services/favoritesService';
import { useRestaurantDetail } from './useRestaurantDetail';
import { getCurrentDayHours, getPaymentNote } from './RestaurantMetadata';
import { FoodTab } from './FoodTab';
import { HoursMoreTab } from './HoursMoreTab';
import { AddressModal } from './AddressModal';

type Props = RootStackScreenProps<'RestaurantDetail'>;

export function RestaurantDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { restaurantId, featuredDishId } = route.params;

  const {
    restaurant,
    loading,
    activeTab,
    setActiveTab,
    hoursExpanded,
    setHoursExpanded,
    showAddressModal,
    setShowAddressModal,
    isFavorite,
    favoriteLoading,
    favoritesInitialized,
    favoriteDishIds,
    setDishFavorite,
    selectedDish,
    setSelectedDish,
    dishOptionGroups,
    dishPhotos,
    setDishPhotos,
    dishRatings,
    userDishOpinions,
    setUserDishOpinions,
    restaurantRating,
    categoryDishes,
    setDishOptionGroups,
    loadAttempt,
    setLoadAttempt,
    setLoading,
    refreshing,
    refresh,
    handleDishPress,
    loadCategoryDishes,
    permanentFilters,
    user,
  } = useRestaurantDetail(restaurantId);

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
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setLoading(true);
              setLoadAttempt(n => n + 1);
            }}
          >
            <Text style={styles.closeButtonText}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const todayHours = getCurrentDayHours(restaurant);
  const isOpenNow = isRestaurantOpenNow(
    restaurant.open_hours as Record<string, { open: string; close: string }> | null
  );
  const paymentNote = getPaymentNote(restaurant.payment_methods, t);

  const handleMenuOption = async (option: string) => {
    switch (option) {
      case 'address':
        setShowAddressModal(true);
        break;
      case 'favorites':
        if (!user) {
          Alert.alert(t('common.signInRequired'), t('favorites.signInToAdd'));
          return;
        }
        try {
          const result = await toggleFavorite(user.id, 'restaurant', restaurantId);
          if (!result.ok) {
            Alert.alert(t('common.error'), t('favorites.updateFailed'));
          } else {
            Alert.alert(
              t('common.success'),
              result.data ? t('favorites.addedToFavorites') : t('favorites.removedFromFavorites')
            );
          }
        } catch (err) {
          console.error('[Favorites] Error:', err);
          Alert.alert(t('common.error'), t('favorites.updateFailed'));
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

  return (
    <View style={styles.container}>
      {/* Compact Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top - 8, spacing.sm) }]}>
        <View style={styles.headerContent}>
          <View style={styles.nameRatingRow}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {restaurant.name}
            </Text>
            {(restaurantRating?.overallPercentage ?? 0) > 0 && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>
                  ⭐ {(restaurantRating!.overallPercentage / 20).toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <RestaurantRatingBadge rating={restaurantRating} showBreakdown={true} />
          {restaurant.cuisine_types && restaurant.cuisine_types.length > 0 && (
            <Text style={styles.cuisineText} numberOfLines={1}>
              {restaurant.cuisine_types.join(', ')}
            </Text>
          )}
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'food' && styles.activeTab]}
          onPress={() => setActiveTab('food')}
        >
          <Text style={[styles.tabText, activeTab === 'food' && styles.activeTabText]}>
            {t('restaurant.foodAndDrinks')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hours' && styles.activeTab]}
          onPress={() => setActiveTab('hours')}
        >
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabText, activeTab === 'hours' && styles.activeTabText]}>
              {t('restaurant.hoursAndMore')}
            </Text>
            <Text style={isOpenNow ? styles.tabOpenBadge : styles.tabClosedBadge}>
              {isOpenNow ? t('restaurant.open') : t('restaurant.closed')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Food & Drinks Tab */}
      {activeTab === 'food' && (
        <FoodTab
          restaurant={restaurant}
          categoryDishes={categoryDishes}
          dishRatings={dishRatings}
          userDishOpinions={userDishOpinions}
          permanentFilters={permanentFilters}
          favoriteDishIds={favoriteDishIds}
          featuredDishId={featuredDishId}
          loadCategoryDishes={loadCategoryDishes}
          onDishPress={handleDishPress}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      )}

      {/* Hours & More Tab */}
      {activeTab === 'hours' && (
        <HoursMoreTab
          restaurant={restaurant}
          hoursExpanded={hoursExpanded}
          setHoursExpanded={setHoursExpanded}
          todayHours={todayHours}
          paymentNote={paymentNote}
          isFavorite={isFavorite}
          favoriteLoading={favoriteLoading}
          favoritesInitialized={favoritesInitialized}
          onShowAddressModal={() => setShowAddressModal(true)}
          onMenuOption={handleMenuOption}
        />
      )}

      {/* Address Modal */}
      <AddressModal
        visible={showAddressModal}
        address={restaurant.address}
        city={restaurant.city}
        postalCode={restaurant.postal_code}
        onClose={() => setShowAddressModal(false)}
      />

      {/* Dish Photo Modal */}
      {selectedDish && (
        <DishPhotoModal
          visible={!!selectedDish}
          onClose={() => {
            setSelectedDish(null);
            setDishPhotos([]);
            setDishOptionGroups([]);
          }}
          dishId={selectedDish.id}
          dishName={selectedDish.name}
          dishDescription={
            selectedDish.description_visibility !== 'menu'
              ? (selectedDish.description ?? undefined)
              : undefined
          }
          dishPrice={selectedDish.price}
          displayPricePrefix={selectedDish.display_price_prefix ?? 'exact'}
          optionGroups={dishOptionGroups}
          photos={dishPhotos}
          onPhotoAdded={() => {
            if (selectedDish) {
              handleDishPress(selectedDish);
            }
          }}
          restaurantId={restaurantId}
          currencyCode={restaurant?.currency_code ?? null}
          existingOpinion={userDishOpinions.get(selectedDish.id) ?? null}
          onRated={opinion => {
            setUserDishOpinions(prev => new Map(prev).set(selectedDish.id, opinion));
          }}
          initialSaved={favoriteDishIds.has(selectedDish.id)}
          onFavoriteChange={saved => setDishFavorite(selectedDish.id, saved)}
        />
      )}
    </View>
  );
}
