/**
 * Map Footer Component
 *
 * Scrollable list of recommended dishes based on user preferences
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { mapFooterStyles } from '@/styles';

// Dish type from mobile hooks
interface Dish {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  price: number;
  cuisine: string;
  imageUrl?: string;
  rating: number;
  isAvailable: boolean;
  dietary_tags: string[];
  allergens: string[];
}

interface MapFooterProps {
  recommendedDishes: Dish[];
  onDishPress: (dish: Dish) => void;
  onFilterPress: () => void;
}

export const MapFooter: React.FC<MapFooterProps> = ({
  recommendedDishes,
  onDishPress,
  onFilterPress,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const getEmoji = (cuisine: string) => {
    if (cuisine.includes('Mexican')) return '🌮';
    if (cuisine.includes('Italian')) return '🍝';
    if (cuisine.includes('Seafood')) return '🐟';
    if (cuisine.includes('Contemporary')) return '🍽️';
    return '🍽️';
  };

  return (
    <View
      style={[mapFooterStyles.container, insets.bottom > 0 && { paddingBottom: insets.bottom + 8 }]}
    >
      <View style={mapFooterStyles.header}>
        <Text style={mapFooterStyles.headerTitle}>🎯 Based on your preferences</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={mapFooterStyles.scrollView}
        contentContainerStyle={mapFooterStyles.scrollContent}
      >
        {recommendedDishes.map(dish => (
          <TouchableOpacity
            key={dish.id}
            style={mapFooterStyles.dishCard}
            onPress={() => onDishPress(dish)}
            activeOpacity={0.8}
          >
            <View style={mapFooterStyles.dishHeader}>
              <Text style={mapFooterStyles.dishEmoji}>{getEmoji(dish.cuisine)}</Text>
              <View style={mapFooterStyles.dishRating}>
                <Text style={mapFooterStyles.ratingText}>⭐ {dish.rating}</Text>
              </View>
            </View>

            <Text style={mapFooterStyles.dishName} numberOfLines={2}>
              {dish.name}
            </Text>

            <View style={mapFooterStyles.restaurantRow}>
              <Text style={mapFooterStyles.restaurantName} numberOfLines={1}>
                {dish.restaurantName}
              </Text>
              <Text style={mapFooterStyles.price}>${dish.price}</Text>
            </View>

            <View style={mapFooterStyles.dishFooter}></View>

            {!dish.isAvailable && (
              <View style={mapFooterStyles.unavailableBadge}>
                <Text style={mapFooterStyles.unavailableText}>{t('common.unavailable')}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Show more button */}
        <TouchableOpacity style={mapFooterStyles.showMoreCard}>
          <Text style={mapFooterStyles.showMoreIcon}>+</Text>
          <Text style={mapFooterStyles.showMoreText}>{t('mapFooter.viewMoreDishes')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Filter Button */}
      <View style={mapFooterStyles.filterSection}>
        <TouchableOpacity style={mapFooterStyles.filterButton} onPress={onFilterPress}>
            <Text style={mapFooterStyles.filterButtonText}>{t('mapFooter.filterButton')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
