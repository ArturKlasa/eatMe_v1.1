import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { formatPrice, isSupportedCurrency, type SupportedCurrency } from '@eatme/shared';
import type { FavoritesScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';
import { colors, spacing, typography, borderRadius } from '@/styles/theme';
import { useSwipeToClose } from '../hooks';
import { useAuthStore } from '../stores/authStore';
import {
  getFavoritesDetailed,
  toggleFavorite,
  type FavoriteDish,
  type FavoriteRestaurant,
} from '../services/favoritesService';

/**
 * FavoritesScreen
 *
 * Lists the user's saved dishes and restaurants. Dishes land here automatically
 * when the user taps "Loved it" (ratingService) and via the dish save heart;
 * restaurants via the restaurant-detail heart. Tapping a row opens the parent
 * restaurant; the ✕ removes the favorite. Supports swipe-down to close.
 */
export function FavoritesScreen({ navigation }: FavoritesScreenProps) {
  const { t } = useTranslation();
  const user = useAuthStore(state => state.user);
  const handleClose = () => navigation.goBack();
  const { translateY, panResponder, handleScroll } = useSwipeToClose(handleClose);

  const [loading, setLoading] = useState(true);
  const [dishes, setDishes] = useState<FavoriteDish[]>([]);
  const [restaurants, setRestaurants] = useState<FavoriteRestaurant[]>([]);

  useFocusEffect(
    useCallback(() => {
      translateY.setValue(0);
      let active = true;

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      getFavoritesDetailed(user.id).then(result => {
        if (!active) return;
        if (result.ok) {
          setDishes(result.data.dishes);
          setRestaurants(result.data.restaurants);
        }
        setLoading(false);
      });

      return () => {
        active = false;
      };
    }, [translateY, user])
  );

  const openRestaurant = (restaurantId: string, featuredDishId?: string) => {
    navigation.navigate('RestaurantDetail', { restaurantId, featuredDishId });
  };

  const removeDish = (dishId: string) => {
    if (!user) return;
    setDishes(prev => prev.filter(d => d.id !== dishId));
    toggleFavorite(user.id, 'dish', dishId);
  };

  const removeRestaurant = (restaurantId: string) => {
    if (!user) return;
    setRestaurants(prev => prev.filter(r => r.id !== restaurantId));
    toggleFavorite(user.id, 'restaurant', restaurantId);
  };

  const dishPriceLabel = (item: FavoriteDish): string => {
    const currency: SupportedCurrency | undefined = isSupportedCurrency(item.currencyCode)
      ? item.currencyCode
      : undefined;
    const formatted = formatPrice(item.price, currency);
    switch (item.displayPricePrefix) {
      case 'from':
        return t('restaurant.price.from', { price: formatted });
      case 'per_person':
        return t('restaurant.price.perPerson', { price: formatted });
      case 'market_price':
        return t('restaurant.price.marketPrice');
      case 'ask_server':
        return t('restaurant.price.askServer');
      default:
        return formatted;
    }
  };

  const isEmpty = dishes.length === 0 && restaurants.length === 0;

  return (
    <View style={modalScreenStyles.container}>
      <TouchableOpacity style={modalScreenStyles.overlay} activeOpacity={1} onPress={handleClose} />
      <Animated.View
        style={[modalScreenStyles.modalContainer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <View style={modalScreenStyles.dragHandle} />

        <View style={modalScreenStyles.header}>
          <Text style={modalScreenStyles.title}>{t('favorites.title')}</Text>
          <Text style={modalScreenStyles.subtitle}>{t('favorites.subtitle')}</Text>
        </View>

        {!user ? (
          <View style={modalScreenStyles.emptyState}>
            <Text style={modalScreenStyles.emptyIcon}>🔒</Text>
            <Text style={modalScreenStyles.emptyTitle}>{t('favorites.signInRequired')}</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>{t('favorites.loading')}</Text>
          </View>
        ) : isEmpty ? (
          <View style={modalScreenStyles.emptyState}>
            <Text style={modalScreenStyles.emptyIcon}>❤️</Text>
            <Text style={modalScreenStyles.emptyTitle}>{t('favorites.empty')}</Text>
            <Text style={modalScreenStyles.emptyDescription}>{t('favorites.emptyMessage')}</Text>
          </View>
        ) : (
          <ScrollView
            style={modalScreenStyles.scrollView}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {dishes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('favorites.dishesSection')}</Text>
                {dishes.map(item => (
                  <View key={item.id} style={styles.row}>
                    <TouchableOpacity
                      style={styles.rowMain}
                      activeOpacity={0.7}
                      onPress={() => openRestaurant(item.restaurantId, item.id)}
                    >
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.image} />
                      ) : (
                        <View style={[styles.image, styles.imagePlaceholder]}>
                          <Text style={styles.placeholderText}>🍽️</Text>
                        </View>
                      )}
                      <View style={styles.info}>
                        <Text style={styles.name} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.secondary} numberOfLines={1}>
                          {item.restaurantName}
                        </Text>
                        <Text style={styles.price}>{dishPriceLabel(item)}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeDish(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {restaurants.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('favorites.restaurantsSection')}</Text>
                {restaurants.map(item => (
                  <View key={item.id} style={styles.row}>
                    <TouchableOpacity
                      style={styles.rowMain}
                      activeOpacity={0.7}
                      onPress={() => openRestaurant(item.id)}
                    >
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.image} />
                      ) : (
                        <View style={[styles.image, styles.imagePlaceholder]}>
                          <Text style={styles.placeholderText}>🍴</Text>
                        </View>
                      )}
                      <View style={styles.info}>
                        <Text style={styles.name} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {!!item.cuisine && (
                          <Text style={styles.secondary} numberOfLines={1}>
                            {item.cuisine}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeRestaurant(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.darkTextSecondary,
    fontSize: typography.size.base,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.darkTextSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.base,
    backgroundColor: colors.darkTertiary,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.white,
  },
  secondary: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    marginTop: 2,
  },
  price: {
    fontSize: typography.size.sm,
    color: colors.accent,
    marginTop: 2,
  },
  removeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  removeText: {
    fontSize: typography.size.lg,
    color: colors.darkTextSecondary,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});

export default FavoritesScreen;
