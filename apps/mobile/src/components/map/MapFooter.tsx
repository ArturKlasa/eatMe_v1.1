/**
 * Map Footer Component
 *
 * Scrollable list of recommended dishes based on user preferences
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { mapFooterStyles } from '@/styles';

// Dish type from mobile hooks
interface Dish {
  id: string;
  name: string;
  restaurantName: string;
  price: number;
  priceRange: string;
  imageUrl?: string;
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
  const getEmoji = (cuisine: string) => {
    if (cuisine.includes('Mexican')) return '🌮';
    if (cuisine.includes('Italian')) return '🍝';
    if (cuisine.includes('Seafood')) return '🐟';
    if (cuisine.includes('Contemporary')) return '🍽️';
    return '🍽️';
  };

  return (
    <View style={mapFooterStyles.container}>
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
                <Text style={mapFooterStyles.unavailableText}>Unavailable</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Show more button */}
        <TouchableOpacity style={mapFooterStyles.showMoreCard}>
          <Text style={mapFooterStyles.showMoreIcon}>+</Text>
          <Text style={mapFooterStyles.showMoreText}>View more{'\n'}dishes</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Filter Button */}
      <View style={mapFooterStyles.filterSection}>
        <TouchableOpacity style={mapFooterStyles.filterButton} onPress={onFilterPress}>
          <Text style={mapFooterStyles.filterButtonText}>🥢 Filter Dishes & Restaurants</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
