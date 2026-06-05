/**
 * Onboarding Step 1: Dietary
 *
 * Collects the user's diet preference (all/vegetarian/vegan) and protein preferences.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { styles } from './OnboardingStep1Screen.styles';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { debugLog } from '../../config/environment';

const DIET_TYPES: Array<{ value: 'all' | 'vegetarian' | 'vegan'; key: string; emoji: string }> = [
  { value: 'all', key: 'dietEverything', emoji: '🍽️' },
  { value: 'vegetarian', key: 'dietVegetarian', emoji: '🥗' },
  { value: 'vegan', key: 'dietVegan', emoji: '🌱' },
];

const PROTEIN_OPTIONS = [
  { value: 'meat', key: 'proteinMeat', emoji: '🥩' },
  { value: 'fish', key: 'proteinFish', emoji: '🐟' },
  { value: 'seafood', key: 'proteinSeafood', emoji: '🦐' },
  { value: 'egg', key: 'proteinEgg', emoji: '🥚' },
];

export function OnboardingStep1Screen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { formData, updateFormData, nextStep } = useOnboardingStore();

  // Safety check and debug logging
  if (!formData) {
    console.error('[OnboardingStep1] formData is null/undefined');
    return null;
  }

  // Additional type validation
  debugLog('[OnboardingStep1] formData:', formData);

  // Helper to safely get array values
  const safeArrayValue = (value: unknown): string[] => {
    if (Array.isArray(value)) return value;
    console.warn('[OnboardingStep1] Non-array value detected:', value);
    return [];
  };

  const handleDietSelect = (diet: 'all' | 'vegetarian' | 'vegan') => {
    updateFormData({ dietType: diet });
  };

  const toggleProtein = (protein: string) => {
    const current = safeArrayValue(formData?.proteinPreferences);
    const updated = current.includes(protein)
      ? current.filter(p => p !== protein)
      : [...current, protein];
    updateFormData({ proteinPreferences: updated });
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
          <Text style={styles.stepIndicator}>{t('onboarding.step1Of2')}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '50%' }]} />
          </View>
          <Text style={styles.title}>{t('onboarding.step1Title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.step1Subtitle')}</Text>
        </View>

        {/* Diet Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('onboarding.dietQuestion')}</Text>
          <View style={styles.optionsGrid}>
            {DIET_TYPES.map(diet => (
              <TouchableOpacity
                key={diet.value}
                style={[
                  styles.optionCard,
                  formData?.dietType === diet.value && styles.optionCardSelected,
                ]}
                onPress={() => handleDietSelect(diet.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionEmoji}>{diet.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    formData?.dietType === diet.value && styles.optionLabelSelected,
                  ]}
                >
                  {t(`onboarding.${diet.key}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Protein Preferences */}
        {formData?.dietType === 'all' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('onboarding.proteinQuestion')}</Text>
            <Text style={styles.sectionSubtitle}>{t('onboarding.selectAll')}</Text>
            <View style={styles.optionsGrid}>
              {PROTEIN_OPTIONS.map(protein => (
                <TouchableOpacity
                  key={protein.value}
                  style={[
                    styles.optionCard,
                    safeArrayValue(formData?.proteinPreferences).includes(protein.value) &&
                      styles.optionCardSelected,
                  ]}
                  onPress={() => toggleProtein(protein.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionEmoji}>{protein.emoji}</Text>
                  <Text
                    style={[
                      styles.optionLabel,
                      safeArrayValue(formData?.proteinPreferences).includes(protein.value) &&
                        styles.optionLabelSelected,
                    ]}
                  >
                    {t(`onboarding.${protein.key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>{t('common.skip')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.nextButtonText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
