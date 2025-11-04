/**
 * Restaurant Detail Screen
 *
 * Modal-style screen displaying restaurant menu
 * Similar to DailyFilterModal design with compact header
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import type { RootStackScreenProps } from '@/types/navigation';
import { getRestaurantMenu, type MenuItem } from '../data/mockRestaurantMenus';
import { restaurantDetailStyles as styles } from '@/styles';

type Props = RootStackScreenProps<'RestaurantDetail'>;

export function RestaurantDetailScreen({ route, navigation }: Props) {
  const { restaurantId } = route.params;
  const restaurant = getRestaurantMenu(restaurantId);
  const [showFullWeekHours, setShowFullWeekHours] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

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

  const handleMenuOption = (option: string) => {
    setShowOptionsMenu(false);

    switch (option) {
      case 'address':
        Alert.alert('Address', 'Address feature coming soon');
        break;
      case 'favorites':
        Alert.alert('Add to Favorites', 'Favorites feature coming soon');
        break;
      case 'review':
        Alert.alert('Add Review', 'Review feature coming soon');
        break;
      case 'share':
        Alert.alert('Share', 'Share feature coming soon');
        break;
      case 'call':
        Alert.alert('Call', 'Call feature coming soon');
        break;
      case 'report':
        Alert.alert('Report', 'Report misleading info feature coming soon');
        break;
    }
  };

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
        {restaurant.menu.map(category => (
          <View key={category.id} style={styles.menuCategory}>
            <Text style={styles.categoryName}>{category.name}</Text>
            {category.items.map(renderMenuItem)}
          </View>
        ))}
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
            >
              <Text style={styles.optionText}>Add to favorites</Text>
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
    </View>
  );
}
