/**
 * Map Footer Component
 *
 * Scrollable list of recommended dishes based on user preferences
 * Uses mock data for now, will be connected to database in the future
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { commonStyles } from '@/styles';
import { Dish } from '@/data/mockDishes';

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

  const getPriceColor = (priceRange: string) => {
    switch (priceRange) {
      case '$':
        return '#4CAF50';
      case '$$':
        return '#FF9800';
      case '$$$':
        return '#FF5722';
      case '$$$$':
        return '#9C27B0';
      default:
        return '#757575';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎯 Recommended for you</Text>
        <Text style={styles.headerSubtitle}>Based on your preferences</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {recommendedDishes.map(dish => (
          <TouchableOpacity
            key={dish.id}
            style={styles.dishCard}
            onPress={() => onDishPress(dish)}
            activeOpacity={0.8}
          >
            <View style={styles.dishHeader}>
              <Text style={styles.dishEmoji}>{getEmoji(dish.cuisine)}</Text>
              <View style={styles.dishRating}>
                <Text style={styles.ratingText}>⭐ {dish.rating}</Text>
              </View>
            </View>

            <Text style={styles.dishName} numberOfLines={2}>
              {dish.name}
            </Text>

            <Text style={styles.restaurantName} numberOfLines={1}>
              {dish.restaurantName}
            </Text>

            <View style={styles.dishFooter}>
              <Text style={[styles.priceRange, { color: getPriceColor(dish.priceRange) }]}>
                {dish.priceRange}
              </Text>
              <Text style={styles.price}>${dish.price}</Text>
            </View>

            {!dish.isAvailable && (
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableText}>Unavailable</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Show more button */}
        <TouchableOpacity style={styles.showMoreCard}>
          <Text style={styles.showMoreIcon}>+</Text>
          <Text style={styles.showMoreText}>View all{'\n'}dishes</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Filter Button */}
      <View style={styles.filterSection}>
        <TouchableOpacity style={styles.filterButton} onPress={onFilterPress}>
          <Text style={styles.filterButtonText}>🥢 Filter Dishes & Restaurants</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = {
  container: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#B0B0B0',
  },
  scrollView: {
    paddingLeft: 20,
  },
  scrollContent: {
    paddingRight: 20,
  },
  dishCard: {
    width: 160,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  dishHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  dishEmoji: {
    fontSize: 24,
  },
  dishRating: {
    backgroundColor: '#333333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
    minHeight: 34,
  },
  restaurantName: {
    fontSize: 12,
    color: '#B0B0B0',
    marginBottom: 8,
  },
  dishFooter: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  priceRange: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  price: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  unavailableBadge: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    backgroundColor: '#FF5722',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unavailableText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  showMoreCard: {
    width: 100,
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: '#FF9800',
    borderStyle: 'dashed' as const,
  },
  showMoreIcon: {
    fontSize: 24,
    color: '#FF9800',
    fontWeight: '300' as const,
    marginBottom: 4,
  },
  showMoreText: {
    fontSize: 12,
    color: '#FF9800',
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  filterButton: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
};
