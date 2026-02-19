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
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

const CUISINE_OPTIONS = [
  { value: 'Mexican', key: 'cuisineMexican', emoji: '🌮' },
  { value: 'Italian', key: 'cuisineItalian', emoji: '🍝' },
  { value: 'Japanese', key: 'cuisineJapanese', emoji: '🍣' },
  { value: 'Chinese', key: 'cuisineChinese', emoji: '🥡' },
  { value: 'Indian', key: 'cuisineIndian', emoji: '🍛' },
  { value: 'Thai', key: 'cuisineThai', emoji: '🍜' },
  { value: 'American', key: 'cuisineAmerican', emoji: '🍔' },
  { value: 'French', key: 'cuisineFrench', emoji: '🥐' },
  { value: 'Korean', key: 'cuisineKorean', emoji: '🍲' },
  { value: 'Mediterranean', key: 'cuisineMediterranean', emoji: '🥙' },
  { value: 'Vietnamese', key: 'cuisineVietnamese', emoji: '🥢' },
  { value: 'Greek', key: 'cuisineGreek', emoji: '🥗' },
];

const DISH_OPTIONS = [
  { value: 'Tacos', key: 'dishTacos', emoji: '🌮' },
  { value: 'Pizza', key: 'dishPizza', emoji: '🍕' },
  { value: 'Sushi', key: 'dishSushi', emoji: '🍣' },
  { value: 'Burger', key: 'dishBurger', emoji: '🍔' },
  { value: 'Pasta', key: 'dishPasta', emoji: '🍝' },
  { value: 'Ramen', key: 'dishRamen', emoji: '🍜' },
  { value: 'Curry', key: 'dishCurry', emoji: '🍛' },
  { value: 'Steak', key: 'dishSteak', emoji: '🥩' },
  { value: 'Salad', key: 'dishSalad', emoji: '🥗' },
  { value: 'Sandwich', key: 'dishSandwich', emoji: '🥪' },
  { value: 'Burrito', key: 'dishBurrito', emoji: '🌯' },
  { value: 'Pho', key: 'dishPho', emoji: '🍲' },
];

const SPICE_LEVELS = [
  { value: 'no', key: 'spiceNo', emoji: '😌' },
  { value: 'yes', key: 'spiceYes', emoji: '🌶️' },
];

export function OnboardingStep2Screen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { formData, updateFormData, completeOnboarding } = useOnboardingStore();

  // Safety check and debug logging
  if (!formData) {
    console.error('[OnboardingStep2] formData is null/undefined');
    return null;
  }

  // Helper to safely get array values
  const safeArrayValue = (value: any): string[] => {
    if (Array.isArray(value)) return value;
    console.warn('[OnboardingStep2] Non-array value detected:', value);
    return [];
  };

  const toggleCuisine = (cuisine: string) => {
    const current = safeArrayValue(formData?.favoriteCuisines);
    const updated = current.includes(cuisine)
      ? current.filter(c => c !== cuisine)
      : [...current, cuisine];
    updateFormData({ favoriteCuisines: updated });
  };

  const toggleDish = (dish: string) => {
    const current = safeArrayValue(formData?.favoriteDishes);
    const updated = current.includes(dish) ? current.filter(d => d !== dish) : [...current, dish];
    updateFormData({ favoriteDishes: updated });
  };

  const handleSpiceSelect = (spice: 'yes' | 'no') => {
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
          <Text style={styles.stepIndicator}>{t('onboarding.step2Of2')}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.title}>{t('onboarding.step2Title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.step2Subtitle')}</Text>
        </View>

        {/* Cuisines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('onboarding.cuisinesQuestion')}</Text>
          <Text style={styles.sectionSubtitle}>{t('onboarding.cuisinesHint')}</Text>
          <View style={styles.optionsGrid}>
            {CUISINE_OPTIONS.map(cuisine => (
              <TouchableOpacity
                key={cuisine.value}
                style={[
                  styles.optionCard,
                  safeArrayValue(formData?.favoriteCuisines).includes(cuisine.value) &&
                    styles.optionCardSelected,
                ]}
                onPress={() => toggleCuisine(cuisine.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionEmoji}>{cuisine.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    safeArrayValue(formData?.favoriteCuisines).includes(cuisine.value) &&
                      styles.optionLabelSelected,
                  ]}
                >
                  {t(`onboarding.${cuisine.key}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dishes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('onboarding.dishesQuestion')}</Text>
          <Text style={styles.sectionSubtitle}>{t('onboarding.dishesHint')}</Text>
          <View style={styles.optionsGrid}>
            {DISH_OPTIONS.map(dish => (
              <TouchableOpacity
                key={dish.value}
                style={[
                  styles.optionCard,
                  safeArrayValue(formData?.favoriteDishes).includes(dish.value) &&
                    styles.optionCardSelected,
                ]}
                onPress={() => toggleDish(dish.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionEmoji}>{dish.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    safeArrayValue(formData?.favoriteDishes).includes(dish.value) &&
                      styles.optionLabelSelected,
                  ]}
                >
                  {t(`onboarding.${dish.key}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Spice Tolerance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('onboarding.spiceQuestion')}</Text>
          <Text style={styles.sectionSubtitle}>{t('onboarding.spiceHint')}</Text>
          <View style={styles.spiceOptions}>
            {SPICE_LEVELS.map(spice => (
              <TouchableOpacity
                key={spice.value}
                style={[
                  styles.spiceCard,
                  formData?.spiceTolerance === spice.value && styles.spiceCardSelected,
                ]}
                onPress={() => handleSpiceSelect(spice.value as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.spiceEmoji}>{spice.emoji}</Text>
                <Text
                  style={[
                    styles.spiceLabel,
                    formData?.spiceTolerance === spice.value && styles.spiceLabelSelected,
                  ]}
                >
                  {t(`onboarding.${spice.key}`)}
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
          <Text style={styles.backButtonText}>{t('onboarding.back')}</Text>
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
            <Text style={styles.nextButtonText}>{t('onboarding.complete')}</Text>
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
