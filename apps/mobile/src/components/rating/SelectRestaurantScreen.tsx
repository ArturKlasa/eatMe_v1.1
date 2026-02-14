/**
 * Select Restaurant Screen
 *
 * First step of the rating flow - user selects which restaurant they ate at.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { RecentlyViewedRestaurant } from '../../types/rating';

interface SelectRestaurantScreenProps {
  restaurants: RecentlyViewedRestaurant[];
  onSelectRestaurant: (restaurant: RecentlyViewedRestaurant) => void;
  onAteSomewhereElse: () => void;
  onCancel: () => void;
}

export function SelectRestaurantScreen({
  restaurants,
  onSelectRestaurant,
  onAteSomewhereElse,
  onCancel,
}: SelectRestaurantScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Did you eat in one of those today?</Text>
        <Text style={styles.subtitle}>Rate your experience and earn rewards</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {restaurants.map(restaurant => (
          <View key={restaurant.id} style={styles.restaurantCard}>
            <View style={styles.restaurantInfo}>
              {restaurant.imageUrl ? (
                <Image source={{ uri: restaurant.imageUrl }} style={styles.restaurantImage} />
              ) : (
                <View style={styles.restaurantImagePlaceholder}>
                  <Text style={styles.restaurantImagePlaceholderText}>🍽️</Text>
                </View>
              )}
              <View style={styles.restaurantDetails}>
                <Text style={styles.restaurantName}>{restaurant.name}</Text>
                <Text style={styles.restaurantCuisine}>{restaurant.cuisine}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => onSelectRestaurant(restaurant)}
            >
              <Text style={styles.selectButtonText}>I ate here</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onAteSomewhereElse}>
          <Text style={styles.secondaryButtonText}>I ate somewhere else</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.darkSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.darkText,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.white,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  restaurantCard: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  restaurantImage: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.base,
  },
  restaurantImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.base,
    backgroundColor: colors.darkTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantImagePlaceholderText: {
    fontSize: 24,
  },
  restaurantDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  restaurantName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  restaurantCuisine: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    marginTop: 2,
  },
  selectButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
  },
  selectButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  secondaryButton: {
    backgroundColor: colors.darkSecondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.darkText,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
  },
});
