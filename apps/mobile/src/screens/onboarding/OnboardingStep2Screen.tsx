/**
 * Onboarding Step 2: Cuisines & Dishes
 *
 * Collects user's favorite cuisines, dishes, and spice tolerance.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

const CUISINE_OPTIONS = [
  { value: 'Mexican', emoji: '🌮' },
  { value: 'Italian', emoji: '🍝' },
  { value: 'Japanese', emoji: '🍣' },
  { value: 'Chinese', emoji: '🥡' },
  { value: 'Indian', emoji: '🍛' },
  { value: 'Thai', emoji: '🍜' },
  { value: 'American', emoji: '🍔' },
  { value: 'French', emoji: '🥐' },
  { value: 'Korean', emoji: '🍲' },
  { value: 'Mediterranean', emoji: '🥙' },
  { value: 'Vietnamese', emoji: '🥢' },
  { value: 'Greek', emoji: '🥗' },
];

const DISH_OPTIONS = [
  { value: 'Tacos', emoji: '🌮' },
  { value: 'Pizza', emoji: '🍕' },
  { value: 'Sushi', emoji: '🍣' },
  { value: 'Burger', emoji: '🍔' },
  { value: 'Pasta', emoji: '🍝' },
  { value: 'Ramen', emoji: '🍜' },
  { value: 'Curry', emoji: '🍛' },
  { value: 'Steak', emoji: '🥩' },
  { value: 'Salad', emoji: '🥗' },
  { value: 'Sandwich', emoji: '🥪' },
  { value: 'Burrito', emoji: '🌯' },
  { value: 'Pho', emoji: '🍲' },
];

const SPICE_LEVELS = [
  { value: 'none', label: 'No Spice', emoji: '😌' },
  { value: 'mild', label: 'Mild', emoji: '🌶️' },
  { value: 'medium', label: 'Medium', emoji: '🌶️🌶️' },
  { value: 'spicy', label: 'Spicy', emoji: '🌶️🌶️🌶️' },
  { value: 'very_spicy', label: 'Very Spicy', emoji: '🔥' },
];

export function OnboardingStep2Screen() {
  const navigation = useNavigation();
  const { formData, updateFormData, completeOnboarding } = useOnboardingStore();

  const toggleCuisine = (cuisine: string) => {
    const current = formData.favoriteCuisines;
    const updated = current.includes(cuisine)
      ? current.filter(c => c !== cuisine)
      : [...current, cuisine];
    updateFormData({ favoriteCuisines: updated });
  };

  const toggleDish = (dish: string) => {
    const current = formData.favoriteDishes;
    const updated = current.includes(dish) ? current.filter(d => d !== dish) : [...current, dish];
    updateFormData({ favoriteDishes: updated });
  };

  const handleSpiceSelect = (spice: 'none' | 'mild' | 'medium' | 'spicy' | 'very_spicy') => {
    updateFormData({ spiceTolerance: spice });
  };

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboarding();
      // Navigate to main app
      navigation.navigate('Map' as never);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>Step 2 of 2</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.title}>Your Food Preferences</Text>
          <Text style={styles.subtitle}>Tell us what you love to eat</Text>
        </View>

        {/* Cuisines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorite Cuisines 🌍</Text>
          <Text style={styles.sectionSubtitle}>Pick at least 2</Text>
          <View style={styles.optionsGrid}>
            {CUISINE_OPTIONS.map(cuisine => (
              <TouchableOpacity
                key={cuisine.value}
                style={[
                  styles.optionCard,
                  formData.favoriteCuisines.includes(cuisine.value) && styles.optionCardSelected,
                ]}
                onPress={() => toggleCuisine(cuisine.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionEmoji}>{cuisine.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    formData.favoriteCuisines.includes(cuisine.value) && styles.optionLabelSelected,
                  ]}
                >
                  {cuisine.value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dishes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorite Dishes 🍽️</Text>
          <Text style={styles.sectionSubtitle}>What do you crave?</Text>
          <View style={styles.optionsGrid}>
            {DISH_OPTIONS.map(dish => (
              <TouchableOpacity
                key={dish.value}
                style={[
                  styles.optionCard,
                  formData.favoriteDishes.includes(dish.value) && styles.optionCardSelected,
                ]}
                onPress={() => toggleDish(dish.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionEmoji}>{dish.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    formData.favoriteDishes.includes(dish.value) && styles.optionLabelSelected,
                  ]}
                >
                  {dish.value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Spice Tolerance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spice Tolerance 🌶️</Text>
          <Text style={styles.sectionSubtitle}>How spicy do you like it?</Text>
          <View style={styles.spiceOptions}>
            {SPICE_LEVELS.map(spice => (
              <TouchableOpacity
                key={spice.value}
                style={[
                  styles.spiceCard,
                  formData.spiceTolerance === spice.value && styles.spiceCardSelected,
                ]}
                onPress={() => handleSpiceSelect(spice.value as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.spiceEmoji}>{spice.emoji}</Text>
                <Text
                  style={[
                    styles.spiceLabel,
                    formData.spiceTolerance === spice.value && styles.spiceLabelSelected,
                  ]}
                >
                  {spice.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.nextButton,
            formData.favoriteCuisines.length < 2 && styles.nextButtonDisabled,
          ]}
          onPress={handleComplete}
          activeOpacity={0.8}
          disabled={formData.favoriteCuisines.length < 2 || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>Complete! 🎉</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  stepIndicator: {
    fontSize: typography.size.sm,
    color: colors.accent,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.darkTertiary,
    borderRadius: 2,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    marginBottom: spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  optionCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  optionCardSelected: {
    borderColor: colors.accent,
    backgroundColor: `${colors.accent}15`,
  },
  optionEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  optionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.darkText,
    textAlign: 'center',
  },
  optionLabelSelected: {
    color: colors.accent,
  },
  spiceOptions: {
    gap: spacing.sm,
  },
  spiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
    gap: spacing.md,
  },
  spiceCardSelected: {
    borderColor: colors.accent,
    backgroundColor: `${colors.accent}15`,
  },
  spiceEmoji: {
    fontSize: 24,
  },
  spiceLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.darkText,
  },
  spiceLabelSelected: {
    color: colors.accent,
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.darkSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorderLight,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.base,
    backgroundColor: colors.darkTertiary,
  },
  backButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.darkTextSecondary,
  },
  nextButton: {
    flex: 2,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.base,
    backgroundColor: colors.accent,
  },
  nextButtonDisabled: {
    backgroundColor: colors.darkTertiary,
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
});
