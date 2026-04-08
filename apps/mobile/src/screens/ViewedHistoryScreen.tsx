/**
 * Viewed History Screen
 *
 * Displays user's recently viewed restaurants
 */

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { styles } from './ViewedHistoryScreen.styles';
import { colors } from '@eatme/tokens';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuthStore } from '../stores/authStore';
import {
  getViewedRestaurants,
  formatViewDate,
  type ViewedRestaurant,
} from '../services/viewHistoryService';
import type { RootStackParamList } from '../types/navigation';

// Fixed item height for FlatList optimization (image 60px + padding 24px + margin 12px)
const HISTORY_ITEM_HEIGHT = 96;

export function ViewedHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const user = useAuthStore(state => state.user);
  const [restaurants, setRestaurants] = useState<ViewedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const viewed = await getViewedRestaurants(user.id);
      setRestaurants(viewed);
      setLoading(false);
    };

    fetchHistory();
  }, [user]);

  const handleShowRestaurant = (restaurantId: string) => {
    navigation.navigate('RestaurantDetail', { restaurantId });
  };

  const renderItem = ({ item }: { item: ViewedRestaurant }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemContent}>
        {/* Restaurant Image */}
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>🍽️</Text>
          </View>
        )}

        {/* Restaurant Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cuisine}>{item.cuisine}</Text>
          <Text style={styles.date}>{formatViewDate(item.viewedAt)}</Text>
        </View>

        {/* Show Button */}
        <TouchableOpacity
          style={styles.showButton}
          onPress={() => handleShowRestaurant(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.showButtonText}>{t('viewedHistory.show')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>{t('viewedHistory.loading')}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>{t('viewedHistory.signInRequired')}</Text>
      </View>
    );
  }

  if (restaurants.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>{t('viewedHistory.empty')}</Text>
        <Text style={styles.emptySubtext}>{t('viewedHistory.emptyMessage')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('viewedHistory.title')}</Text>
      <Text style={styles.subheader}>{t('viewedHistory.subtitle')}</Text>

      <FlatList
        data={restaurants}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        getItemLayout={(_data, index) => ({
          length: HISTORY_ITEM_HEIGHT,
          offset: HISTORY_ITEM_HEIGHT * index,
          index,
        })}
      />
    </View>
  );
}
