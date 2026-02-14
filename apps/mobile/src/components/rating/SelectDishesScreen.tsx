/**
 * Select Dishes Screen
 *
 * Second step of the rating flow - user selects which dishes they ate.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { RecentlyViewedRestaurant, RecentlyViewedDish } from '../../types/rating';

interface SelectDishesScreenProps {
  restaurant: RecentlyViewedRestaurant;
  allDishes: RecentlyViewedDish[];
  onContinue: (selectedDishes: RecentlyViewedDish[]) => void;
  onBack: () => void;
}

export function SelectDishesScreen({
  restaurant,
  allDishes,
  onContinue,
  onBack,
}: SelectDishesScreenProps) {
  const [selectedDishIds, setSelectedDishIds] = useState<Set<string>>(new Set());

  // Sort dishes: viewed dishes first (by view time), then the rest
  const sortedDishes = [...allDishes].sort((a, b) => {
    const aViewed = restaurant.viewedDishes.some(d => d.id === a.id);
    const bViewed = restaurant.viewedDishes.some(d => d.id === b.id);
    if (aViewed && !bViewed) return -1;
    if (!aViewed && bViewed) return 1;
    return 0;
  });

  const toggleDish = (dishId: string) => {
    setSelectedDishIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dishId)) {
        newSet.delete(dishId);
      } else {
        newSet.add(dishId);
      }
      return newSet;
    });
  };

  const handleContinue = () => {
    const selectedDishes = allDishes.filter(d => selectedDishIds.has(d.id));
    onContinue(selectedDishes);
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>What did you have at {restaurant.name}?</Text>
        <Text style={styles.subtitle}>Select all dishes you tried</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {sortedDishes.map(dish => {
          const isSelected = selectedDishIds.has(dish.id);
          return (
            <TouchableOpacity
              key={dish.id}
              style={[styles.dishCard, isSelected && styles.dishCardSelected]}
              onPress={() => toggleDish(dish.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.dishInfo}>
                <Text style={[styles.dishName, isSelected && styles.dishNameSelected]}>
                  {dish.name}
                </Text>
              </View>
              <Text style={styles.dishPrice}>{formatPrice(dish.price)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            selectedDishIds.size === 0 && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={selectedDishIds.size === 0}
        >
          <Text style={styles.continueButtonText}>
            Continue {selectedDishIds.size > 0 ? `(${selectedDishIds.size} selected)` : ''}
          </Text>
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
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.darkSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: 20,
    color: colors.darkText,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.white,
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
  dishCard: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dishCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.darkTertiary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.darkBorderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    fontSize: 14,
    color: colors.white,
    fontWeight: typography.weight.bold,
  },
  dishInfo: {
    flex: 1,
  },
  dishName: {
    fontSize: typography.size.base,
    color: colors.darkText,
  },
  dishNameSelected: {
    color: colors.white,
    fontWeight: typography.weight.medium,
  },
  dishPrice: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    marginLeft: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  continueButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: colors.darkTertiary,
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
});
