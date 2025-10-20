/**
 * Restaurant Detail Screen
 *
 * Modal-style screen displaying restaurant menu
 * Similar to DailyFilterModal design with compact header
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import type { RootStackScreenProps } from '@/types/navigation';
import { getRestaurantMenu, type MenuItem } from '../data/mockRestaurantMenus';

type Props = RootStackScreenProps<'RestaurantDetail'>;

export const RestaurantDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { restaurantId } = route.params;
  const restaurant = getRestaurantMenu(restaurantId);
  const [showFullWeekHours, setShowFullWeekHours] = useState(false);

  if (!restaurant) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Restaurant not found</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const getCurrentDayHours = () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    return restaurant.openingHours[today as keyof typeof restaurant.openingHours];
  };

  const getCurrentDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const todayHours = getCurrentDayHours();
  const isOpenNow = restaurant.isOpen;

  // Determine payment note
  const getPaymentNote = () => {
    const { acceptsCards, acceptsCash } = restaurant.paymentMethods;
    if (!acceptsCards && acceptsCash) return '💵 Cash Only';
    if (acceptsCards && !acceptsCash) return '💳 Card Only';
    return null;
  };

  const paymentNote = getPaymentNote();

  // Generate restaurant dietary info text
  const getDietaryInfo = () => {
    const info: string[] = [];

    // Check if restaurant has vegetarian options
    const hasVegetarian = restaurant.menu.some(category =>
      category.items.some(item => item.isVegetarian)
    );
    if (hasVegetarian) info.push('Vegetarian options');

    // Check if restaurant has vegan options
    const hasVegan = restaurant.menu.some(category => category.items.some(item => item.isVegan));
    if (hasVegan) info.push('Vegan options');

    return info.join(' • ');
  };

  const dietaryInfo = getDietaryInfo();

  const renderMenuItem = (item: MenuItem) => (
    <View key={item.id} style={styles.menuItem}>
      <View style={styles.menuItemHeader}>
        <Text style={styles.menuItemName}>
          {item.name}
          {item.isVegan && ' 🌱'}
          {item.isVegetarian && !item.isVegan && ' 🥬'}
        </Text>
        <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
      </View>
      <Text style={styles.menuItemIngredients}>{item.ingredients.join(', ')}</Text>
    </View>
  );

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

          {/* Cuisine Type */}
          <Text style={styles.cuisineText}>{restaurant.cuisine}</Text>

          {/* Dietary Info */}
          {dietaryInfo && <Text style={styles.dietaryInfoText}>{dietaryInfo}</Text>}

          {/* Opening Hours and Payment Row */}
          <View style={styles.hoursPaymentRow}>
            {/* Opening Hours - Clickable to expand */}
            <TouchableOpacity
              style={styles.hoursContainer}
              onPress={() => setShowFullWeekHours(!showFullWeekHours)}
              activeOpacity={0.7}
            >
              <View style={styles.hoursMainRow}>
                <Text style={styles.hoursLabel}>
                  🕐 {getCurrentDayName()}: {todayHours.open} - {todayHours.close}
                </Text>
                {isOpenNow && <Text style={styles.openBadge}>Open Now</Text>}
                <Text style={styles.expandIcon}>{showFullWeekHours ? '▼' : '▶'}</Text>
              </View>

              {/* Full Week Hours - Expandable */}
              {showFullWeekHours && (
                <View style={styles.fullWeekHours}>
                  {Object.entries(restaurant.openingHours).map(([day, hours]) => (
                    <View key={day} style={styles.weekDayRow}>
                      <Text style={styles.weekDayName}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </Text>
                      <Text style={styles.weekDayHours}>
                        {hours.open} - {hours.close}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Menu Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {restaurant.menu.map(category => (
          <View key={category.id} style={styles.menuCategory}>
            <Text style={styles.categoryName}>{category.name}</Text>
            {category.items.map(renderMenuItem)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#E0E0E0',
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  nameRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  ratingBadge: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cuisineText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  dietaryInfoText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  tag: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  tagText: {
    fontSize: 12,
    color: '#E0E0E0',
    fontWeight: '500',
  },
  restaurantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  hoursPaymentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  hoursContainer: {
    padding: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  hoursMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  hoursLabel: {
    fontSize: 13,
    color: '#E0E0E0',
    fontWeight: '500',
    flexShrink: 0,
  },
  expandIcon: {
    fontSize: 10,
    color: '#AAAAAA',
    marginLeft: 4,
  },
  fullWeekHours: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#3A3A3A',
  },
  weekHoursTitle: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  weekDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  weekDayName: {
    fontSize: 12,
    color: '#CCCCCC',
    textTransform: 'capitalize',
    width: 100,
  },
  weekDayHours: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  paymentNoteContainer: {
    padding: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rating: {
    fontSize: 13,
    color: '#FFFFFF',
    marginRight: 6,
  },
  reviews: {
    fontSize: 13,
    color: '#AAAAAA',
    marginRight: 6,
  },
  openBadge: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '700',
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  closedBadge: {
    fontSize: 13,
    color: '#F44336',
    fontWeight: '600',
    marginRight: 6,
  },
  paymentNote: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '500',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  menuCategory: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF9800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E0E0E0',
    flex: 1,
    marginRight: 8,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF9800',
  },
  menuItemIngredients: {
    fontSize: 13,
    color: '#999999',
    lineHeight: 18,
  },
});
