/**
 * Onboarding Step 1: Dietary & Allergies
 *
 * Collects user's dietary preferences, protein preferences, and allergies.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

const DIET_TYPES = [
  { value: 'all', label: 'Everything', emoji: '🍽️' },
  { value: 'vegetarian', label: 'Vegetarian', emoji: '🥗' },
  { value: 'vegan', label: 'Vegan', emoji: '🌱' },
];

const PROTEIN_OPTIONS = [
  { value: 'meat', label: 'Meat', emoji: '🥩' },
  { value: 'fish', label: 'Fish', emoji: '🐟' },
  { value: 'seafood', label: 'Seafood', emoji: '🦐' },
  { value: 'egg', label: 'Eggs', emoji: '🥚' },
];

const ALLERGY_OPTIONS = [
  { value: 'nuts', label: 'Nuts', emoji: '🥜' },
  { value: 'dairy', label: 'Dairy', emoji: '🥛' },
  { value: 'gluten', label: 'Gluten', emoji: '🌾' },
  { value: 'shellfish', label: 'Shellfish', emoji: '🦐' },
  { value: 'eggs', label: 'Eggs', emoji: '🥚' },
  { value: 'soy', label: 'Soy', emoji: '🫘' },
];

export function OnboardingStep1Screen() {
  const navigation = useNavigation();
  const { formData, updateFormData, nextStep } = useOnboardingStore();

  const handleDietSelect = (diet: 'all' | 'vegetarian' | 'vegan') => {
    updateFormData({ dietType: diet });
  };

  const toggleProtein = (protein: string) => {
    const current = formData.proteinPreferences;
    const updated = current.includes(protein)
      ? current.filter(p => p !== protein)
      : [...current, protein];
    updateFormData({ proteinPreferences: updated });
  };

  const toggleAllergy = (allergy: string) => {
    const current = formData.allergies;
    const updated = current.includes(allergy)
      ? current.filter(a => a !== allergy)
      : [...current, allergy];
    updateFormData({ allergies: updated });
  };

  const handleNext = () => {
    nextStep();
    navigation.navigate('OnboardingStep2' as never);
  };

  const handleSkip = () => {
    navigation.navigate('OnboardingStep2' as never);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>Step 1 of 2</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '50%' }]} />
          </View>
          <Text style={styles.title}>Your Dietary Preferences</Text>
          <Text style={styles.subtitle}>Help us personalize your food recommendations</Text>
        </View>

        {/* Diet Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's your diet? 🍽️</Text>
          <View style={styles.optionsGrid}>
            {DIET_TYPES.map(diet => (
              <TouchableOpacity
                key={diet.value}
                style={[
                  styles.optionCard,
                  formData.dietType === diet.value && styles.optionCardSelected,
                ]}
                onPress={() => handleDietSelect(diet.value as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionEmoji}>{diet.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    formData.dietType === diet.value && styles.optionLabelSelected,
                  ]}
                >
                  {diet.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Protein Preferences */}
        {formData.dietType === 'all' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What proteins do you enjoy? 🥩</Text>
            <Text style={styles.sectionSubtitle}>Select all that apply</Text>
            <View style={styles.optionsGrid}>
              {PROTEIN_OPTIONS.map(protein => (
                <TouchableOpacity
                  key={protein.value}
                  style={[
                    styles.optionCard,
                    formData.proteinPreferences.includes(protein.value) &&
                      styles.optionCardSelected,
                  ]}
                  onPress={() => toggleProtein(protein.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionEmoji}>{protein.emoji}</Text>
                  <Text
                    style={[
                      styles.optionLabel,
                      formData.proteinPreferences.includes(protein.value) &&
                        styles.optionLabelSelected,
                    ]}
                  >
                    {protein.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Allergies */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Any food allergies? 🚫</Text>
          <Text style={styles.sectionSubtitle}>We'll help you avoid these</Text>
          <View style={styles.optionsGrid}>
            {ALLERGY_OPTIONS.map(allergy => (
              <TouchableOpacity
                key={allergy.value}
                style={[
                  styles.optionCard,
                  formData.allergies.includes(allergy.value) && styles.optionCardSelected,
                ]}
                onPress={() => toggleAllergy(allergy.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionEmoji}>{allergy.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    formData.allergies.includes(allergy.value) && styles.optionLabelSelected,
                  ]}
                >
                  {allergy.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.nextButtonText}>Continue →</Text>
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
    padding: spacing.md,
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.darkText,
    textAlign: 'center',
  },
  optionLabelSelected: {
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
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.base,
    backgroundColor: colors.darkTertiary,
  },
  skipButtonText: {
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
  nextButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
});
