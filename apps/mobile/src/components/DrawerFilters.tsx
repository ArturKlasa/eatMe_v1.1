/**
 * Permanent Filters Component - DrawerFilters
 *
 * Permanent (HARD) filtering interface — excludes non-matching dishes from the feed:
 * 1. Diet Preference: All/Vegetarian/Vegan (single selection)
 * 2. Exclude: No meat, No fish, No seafood, No eggs, No spicy (multiple selection)
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

  const { permanent, setPermanentDietPreference, toggleExclude, resetPermanentFilters } =
    useFilterStore();

  const formatLabel = (key: string): string =>
    key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

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
        <Text style={drawerFiltersStyles.sectionTitle}>{t('filters.dietPreferenceTitle')}</Text>
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
                {t(`filters.dietOption.${option}`)}
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
    </ScrollView>
  );
};
