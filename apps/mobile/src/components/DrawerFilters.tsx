/**
 * Permanent Filters Component - DrawerFilters
 *
 * Comprehensive permanent filtering interface:
 * 1. Diet Preference: All/Vegetarian/Vegan (single selection)
 * 2. Exclude: No meat, No fish, No seafood, No eggs, No dairy (multiple selection)
 * 3. Allergies: Lactose, Gluten, Peanuts, Soy, Sesame, Shellfish, Nuts (multiple selection)
 * 4. Diet Preferences: Diabetic, Keto, Paleo, Low-carb, Pescatarian (multiple selection)
 * 5. Religious Restrictions: Halal, Hindu, Kosher (multiple selection)
 * 6. Restaurant Facilities: Family-friendly, Wheelchair-accessible, Pet-friendly, LGBT-accessible, Kid's menu (multiple selection)
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFilterStore } from '../stores/filterStore';
import { drawerFiltersStyles } from '@/styles';

interface DrawerFiltersProps {
  onClose?: () => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export const DrawerFilters: React.FC<DrawerFiltersProps> = ({ onClose, onScroll }) => {
  const { t } = useTranslation();

  // ── Store ────────────────────────────────────────────────────────────────

  const {
    permanent,
    setPermanentDietPreference,
    toggleExclude,
    toggleAllergy,
    toggleDietType,
    toggleReligiousRestriction,
    toggleFacility,
    resetPermanentFilters,
  } = useFilterStore();

  const formatLabel = (key: string): string =>
    key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

  const formatCamelCase = (key: string): string =>
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/^./, str => str.toUpperCase());

  // Helper function to check if exclude options should be disabled
  const isExcludeDisabled = (exclusionKey: string) => {
    if (permanent.dietPreference === 'vegan') {
      // All exclude options are disabled for vegan
      return true;
    }
    if (permanent.dietPreference === 'vegetarian') {
      // Meat, fish, and seafood are disabled for vegetarian
      return exclusionKey === 'noMeat' || exclusionKey === 'noFish' || exclusionKey === 'noSeafood';
    }
    return false;
  };

  return (
    <ScrollView style={drawerFiltersStyles.container} onScroll={onScroll} scrollEventThrottle={16}>
      <View style={drawerFiltersStyles.header}>
        <Text style={drawerFiltersStyles.title}>{t('filters.personalPreferences')}</Text>
        <TouchableOpacity onPress={onClose} style={drawerFiltersStyles.clearButton}>
          <Text style={drawerFiltersStyles.clearButtonText}>{t('common.apply')}</Text>
        </TouchableOpacity>
      </View>

      {/* 1. Diet Preference - Single Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>🥗 Diet Preference</Text>
        <View style={drawerFiltersStyles.tabContainer}>
          {(['all', 'vegetarian', 'vegan'] as const).map(option => (
            <TouchableOpacity
              key={option}
              style={[
                drawerFiltersStyles.tab,
                permanent.dietPreference === option && drawerFiltersStyles.selectedTab,
              ]}
              onPress={() => setPermanentDietPreference(option)}
            >
              <Text
                style={[
                  drawerFiltersStyles.tabText,
                  permanent.dietPreference === option && drawerFiltersStyles.selectedTabText,
                ]}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 2. Exclude - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>{t('filters.excludeTitle')}</Text>
        <View style={drawerFiltersStyles.optionsContainer}>
          {(Object.keys(permanent.exclude) as (keyof typeof permanent.exclude)[]).map(exclusion => {
            const disabled = isExcludeDisabled(exclusion);
            return (
              <TouchableOpacity
                key={exclusion}
                style={[
                  drawerFiltersStyles.option,
                  permanent.exclude[exclusion] && !disabled && drawerFiltersStyles.selectedOption,
                  disabled && drawerFiltersStyles.disabledOption,
                ]}
                onPress={() => {
                  if (!disabled) {
                    toggleExclude(exclusion);
                  }
                }}
                disabled={disabled}
              >
                <Text
                  style={[
                    drawerFiltersStyles.optionText,
                    permanent.exclude[exclusion] && !disabled && drawerFiltersStyles.selectedText,
                    disabled && drawerFiltersStyles.disabledText,
                  ]}
                >
                  {t(`filters.exclude.${exclusion}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Allergies - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>{t('filters.allergiesTitle')}</Text>
        <View style={drawerFiltersStyles.optionsContainer}>
          {(Object.keys(permanent.allergies) as (keyof typeof permanent.allergies)[]).map(
            allergy => (
              <TouchableOpacity
                key={allergy}
                style={[
                  drawerFiltersStyles.option,
                  permanent.allergies[allergy] && drawerFiltersStyles.selectedOption,
                ]}
                onPress={() => toggleAllergy(allergy)}
              >
                <Text
                  style={[
                    drawerFiltersStyles.optionText,
                    permanent.allergies[allergy] && drawerFiltersStyles.selectedText,
                  ]}
                >
                  {t(`filters.allergy.${allergy}`)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* 4. Diet Preferences - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>{t('filters.dietPreferencesTitle')}</Text>
        <View style={drawerFiltersStyles.optionsContainer}>
          {(Object.keys(permanent.dietTypes) as (keyof typeof permanent.dietTypes)[]).map(
            dietType => (
              <TouchableOpacity
                key={dietType}
                style={[
                  drawerFiltersStyles.option,
                  permanent.dietTypes[dietType] && drawerFiltersStyles.selectedOption,
                ]}
                onPress={() => toggleDietType(dietType)}
              >
                <Text
                  style={[
                    drawerFiltersStyles.optionText,
                    permanent.dietTypes[dietType] && drawerFiltersStyles.selectedText,
                  ]}
                >
                  {t(`filters.dietType.${dietType}`)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* 5. Religious Restrictions - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>
          {t('filters.religiousRestrictionsTitle')}
        </Text>
        <View style={drawerFiltersStyles.optionsContainer}>
          {(
            Object.keys(
              permanent.religiousRestrictions
            ) as (keyof typeof permanent.religiousRestrictions)[]
          ).map(restriction => (
            <TouchableOpacity
              key={restriction}
              style={[
                drawerFiltersStyles.option,
                permanent.religiousRestrictions[restriction] && drawerFiltersStyles.selectedOption,
              ]}
              onPress={() => toggleReligiousRestriction(restriction)}
            >
              <Text
                style={[
                  drawerFiltersStyles.optionText,
                  permanent.religiousRestrictions[restriction] && drawerFiltersStyles.selectedText,
                ]}
              >
                {t(`filters.religious.${restriction}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 6. Restaurant Facilities - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>🏪 Restaurant Facilities</Text>
        <View style={drawerFiltersStyles.optionsContainer}>
          {(Object.keys(permanent.facilities) as (keyof typeof permanent.facilities)[]).map(
            facility => (
              <TouchableOpacity
                key={facility}
                style={[
                  drawerFiltersStyles.option,
                  permanent.facilities[facility] && drawerFiltersStyles.selectedOption,
                ]}
                onPress={() => toggleFacility(facility)}
              >
                <Text
                  style={[
                    drawerFiltersStyles.optionText,
                    permanent.facilities[facility] && drawerFiltersStyles.selectedText,
                  ]}
                >
                  {formatCamelCase(facility)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    </ScrollView>
  );
};
