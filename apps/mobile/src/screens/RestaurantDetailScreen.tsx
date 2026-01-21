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
} from 'react-native';
import type { RootStackScreenProps } from '@/types/navigation';
import { getRestaurantMenu, type MenuItem } from '../data/mockRestaurantMenus';
import { supabase } from '../lib/supabase';
import { restaurantDetailStyles as styles } from '@/styles';

type Props = RootStackScreenProps<'RestaurantDetail'>;

export function RestaurantDetailScreen({ route, navigation }: Props) {
  const { restaurantId } = route.params;
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFullWeekHours, setShowFullWeekHours] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

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
              dishes (*)
            )
          `
          )
          .eq('id', restaurantId)
          .single();

        if (error) throw error;

        if (data) {
          setRestaurant(data);
        }
      } catch (err) {
        console.error('Failed to load restaurant:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [restaurantId]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={{ marginTop: 16, color: '#666' }}>Loading restaurant...</Text>
      </View>
    );
  }

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

  const renderMenuItem = (item: any) => (
    <View key={item.id} style={styles.menuItem}>
      <View style={styles.menuItemHeader}>
        <Text style={styles.menuItemName}>
          {item.name}
          {item.dietary_tags?.includes('vegan') && ' 🌱'}
          {item.dietary_tags?.includes('vegetarian') &&
            !item.dietary_tags?.includes('vegan') &&
            ' 🥬'}
        </Text>
        <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
      </View>
      {item.description && <Text style={styles.menuItemIngredients}>{item.description}</Text>}
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
                  🕐 {getCurrentDayName()}: {todayHours?.open || 'N/A'} -{' '}
                  {todayHours?.close || 'N/A'}
                </Text>
                {isOpenNow && <Text style={styles.openBadge}>Open Now</Text>}
                <Text style={styles.expandIcon}>{showFullWeekHours ? '▼' : '▶'}</Text>
              </View>

              {/* Full Week Hours - Expandable */}
              {showFullWeekHours && (restaurant.operating_hours || restaurant.open_hours) && (
                <View style={styles.fullWeekHours}>
                  {Object.entries(restaurant.operating_hours || restaurant.open_hours || {}).map(
                    ([day, hours]: [string, any]) => (
                      <View key={day} style={styles.weekDayRow}>
                        <Text style={styles.weekDayName}>
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </Text>
                        <Text style={styles.weekDayHours}>
                          {hours.open} - {hours.close}
                        </Text>
                      </View>
                    )
                  )}
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
        {restaurant.menus?.map((menu: any) => (
          <View key={menu.id} style={styles.menuCategory}>
            <Text style={styles.categoryName}>{menu.name}</Text>
            {menu.dishes?.map(renderMenuItem)}
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
