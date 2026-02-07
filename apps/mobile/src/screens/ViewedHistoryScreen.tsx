/**
 * Viewed History Screen
 *
 * Displays user's recently viewed restaurants
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { useAuthStore } from '../stores/authStore';
import {
  getViewedRestaurants,
  formatViewDate,
  type ViewedRestaurant,
} from '../services/viewHistoryService';
import type { RootStackParamList } from '../types/navigation';

export function ViewedHistoryScreen() {
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
          <Text style={styles.showButtonText}>Show</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Please sign in to view history</Text>
      </View>
    );
  }

  if (restaurants.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No restaurants viewed yet</Text>
        <Text style={styles.emptySubtext}>
          Start exploring restaurants and they'll appear here!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Recently Viewed</Text>
      <Text style={styles.subheader}>Last 15 restaurants you've checked out</Text>

      <FlatList
        data={restaurants}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark,
    padding: spacing.xl,
  },
  header: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.darkText,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  subheader: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.darkTextSecondary,
    fontSize: typography.size.base,
  },
  emptyText: {
    fontSize: typography.size.lg,
    color: colors.darkText,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.lg,
  },
  itemContainer: {
    marginBottom: spacing.md,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  imagePlaceholder: {
    backgroundColor: colors.darkTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 28,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  cuisine: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    marginBottom: spacing.xs,
  },
  date: {
    fontSize: typography.size.xs,
    color: colors.darkTextMuted,
  },
  showButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  showButtonText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
