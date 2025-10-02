/**
 * Filter UI Components
 *
 * Comprehensive filter components for restaurant and dish filtering.
 * Includes price range, cuisine selection, dietary restrictions, and more.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import Slider from 'react-native-slider';
import { useFilterStore, DAILY_FILTER_PRESETS } from '../stores/filterStore';
import { commonStyles, theme } from '@/styles';

// Available cuisine types based on our mock data
const CUISINE_TYPES = [
  'Mexican',
  'Fine Dining',
  'Seafood',
  'Italian',
  'International',
  'Asian',
  'Mediterranean',
  'American',
  'Fusion',
  'Vegetarian',
  'Fast Food',
  'Comfort Food',
];

// Price level labels
const PRICE_LABELS = ['$', '$$', '$$$', '$$$$'];

// Spice level labels with heat indicators
const SPICE_LABELS = [
  { label: 'None', icon: '🥛', value: 0 },
  { label: 'Mild', icon: '🌶️', value: 1 },
  { label: 'Medium', icon: '🌶️🌶️', value: 2 },
  { label: 'Hot', icon: '🌶️🌶️🌶️', value: 3 },
  { label: 'Very Hot', icon: '🔥🔥🔥', value: 4 },
];

/**
 * Price Range Slider Component
 */
export const PriceRangeFilter: React.FC = () => {
  const { daily, setDailyPriceRange } = useFilterStore();

  const handlePriceChange = (values: number[]) => {
    setDailyPriceRange(values[0], values[1]);
  };

  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>💰 Price Range</Text>
      <View style={styles.priceRangeContainer}>
        <Text style={styles.priceLabel}>
          {PRICE_LABELS[daily.priceRange.min - 1]} - {PRICE_LABELS[daily.priceRange.max - 1]}
        </Text>
      </View>

      {/* Custom dual slider implementation */}
      <View style={styles.sliderContainer}>
        <View style={styles.sliderLabels}>
          {PRICE_LABELS.map((label, index) => (
            <Text key={index} style={styles.sliderLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.sliderRow}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={4}
            value={daily.priceRange.min}
            onValueChange={value => setDailyPriceRange(Math.round(value), daily.priceRange.max)}
            step={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.gray200}
            thumbStyle={styles.sliderThumb}
          />
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={4}
            value={daily.priceRange.max}
            onValueChange={value => setDailyPriceRange(daily.priceRange.min, Math.round(value))}
            step={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.gray200}
            thumbStyle={styles.sliderThumb}
          />
        </View>
      </View>
    </View>
  );
};

/**
 * Cuisine Type Multi-Select Component
 */
export const CuisineTypeFilter: React.FC = () => {
  const { daily, toggleDailyCuisine, setDailyCuisines } = useFilterStore();

  const clearAllCuisines = () => {
    setDailyCuisines([]);
  };

  const selectAllCuisines = () => {
    setDailyCuisines([...CUISINE_TYPES]);
  };

  return (
    <View style={styles.filterSection}>
      <View style={styles.filterTitleRow}>
        <Text style={styles.filterTitle}>🍽️ Cuisine Types</Text>
        <View style={styles.filterActions}>
          <TouchableOpacity onPress={clearAllCuisines} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={selectAllCuisines} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>All</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.checkboxGrid}>
        {CUISINE_TYPES.map(cuisine => (
          <TouchableOpacity
            key={cuisine}
            style={[
              styles.checkboxItem,
              daily.cuisineTypes.includes(cuisine) && styles.checkboxItemSelected,
            ]}
            onPress={() => toggleDailyCuisine(cuisine)}
          >
            <View
              style={[
                styles.checkbox,
                daily.cuisineTypes.includes(cuisine) && styles.checkboxSelected,
              ]}
            >
              {daily.cuisineTypes.includes(cuisine) && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text
              style={[
                styles.checkboxLabel,
                daily.cuisineTypes.includes(cuisine) && styles.checkboxLabelSelected,
              ]}
            >
              {cuisine}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

/**
 * Diet Toggle Component (for Daily Filters)
 * Updated for new diet preference structure
 */
export const DietToggleFilter: React.FC = () => {
  const { daily, setDietPreference, toggleProteinType } = useFilterStore();

  const dietPreferenceOptions = [
    { key: 'all', label: 'All' },
    { key: 'vegetarian', label: 'Vegetarian' },
    { key: 'vegan', label: 'Vegan' },
  ];

  const proteinOptions = [
    { key: 'meat', label: 'Meat', icon: '🥩' },
    { key: 'fish', label: 'Fish', icon: '🐟' },
    { key: 'seafood', label: 'Seafood', icon: '🦐' },
  ];

  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>🍽️ Diet Options</Text>

      {/* Diet Preference Selection */}
      <View style={styles.toggleList}>
        <Text style={styles.filterSubtitle}>Diet Preference</Text>
        {dietPreferenceOptions.map(option => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.toggleItem,
              daily.dietPreference === option.key && { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => setDietPreference(option.key as any)}
          >
            <Text
              style={[
                styles.toggleText,
                daily.dietPreference === option.key && { color: theme.colors.white },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Protein Types */}
      <View style={styles.toggleList}>
        <Text style={styles.filterSubtitle}>Protein Types</Text>
        {proteinOptions.map(option => (
          <View key={option.key} style={styles.toggleItem}>
            <View style={styles.toggleLabel}>
              <Text style={styles.toggleIcon}>{option.icon}</Text>
              <Text style={styles.toggleText}>{option.label}</Text>
            </View>
            <Switch
              value={daily.proteinTypes[option.key as keyof typeof daily.proteinTypes]}
              onValueChange={() => toggleProteinType(option.key as any)}
              trackColor={{ false: theme.colors.gray200, true: theme.colors.primary }}
              thumbColor={theme.colors.white}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

/**
 * Spice Level Selector Component (Currently disabled - not in daily filters)
 */
// Temporarily disabled - spice level not part of daily filters
// export const SpiceLevelFilter: React.FC = () => { return null; };

/**
 * Calorie Range Filter Component (Optional)
 */
export const CalorieRangeFilter: React.FC = () => {
  const { daily, setDailyCalorieRange } = useFilterStore();

  return (
    <View style={styles.filterSection}>
      <View style={styles.filterTitleRow}>
        <Text style={styles.filterTitle}>🔥 Calorie Range</Text>
        <Switch
          value={daily.calorieRange.enabled}
          onValueChange={enabled =>
            setDailyCalorieRange(daily.calorieRange.min, daily.calorieRange.max, enabled)
          }
          trackColor={{ false: theme.colors.gray200, true: theme.colors.primary }}
          thumbColor={theme.colors.white}
        />
      </View>

      {daily.calorieRange.enabled && (
        <View style={styles.calorieContainer}>
          <Text style={styles.calorieLabel}>
            {daily.calorieRange.min} - {daily.calorieRange.max} calories
          </Text>

          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={2000}
              value={daily.calorieRange.min}
              onValueChange={value =>
                setDailyCalorieRange(Math.round(value), daily.calorieRange.max, true)
              }
              step={50}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.gray200}
              thumbStyle={styles.sliderThumb}
            />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={2000}
              value={daily.calorieRange.max}
              onValueChange={value =>
                setDailyCalorieRange(daily.calorieRange.min, Math.round(value), true)
              }
              step={50}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.gray200}
              thumbStyle={styles.sliderThumb}
            />
          </View>
        </View>
      )}
    </View>
  );
};

/**
 * Quick Filter Preset Buttons
 */
export const QuickFilterPresets: React.FC = () => {
  const { activePreset, applyPreset, resetDailyFilters } = useFilterStore();

  const presetKeys = Object.keys(DAILY_FILTER_PRESETS);

  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>⚡ Quick Filters</Text>

      <View style={styles.presetGrid}>
        {presetKeys.map(presetKey => {
          const preset = DAILY_FILTER_PRESETS[presetKey as keyof typeof DAILY_FILTER_PRESETS];
          return (
            <TouchableOpacity
              key={presetKey}
              style={[styles.presetButton, activePreset === presetKey && styles.presetButtonActive]}
              onPress={() => applyPreset(presetKey)}
            >
              <Text
                style={[
                  styles.presetButtonText,
                  activePreset === presetKey && styles.presetButtonTextActive,
                ]}
              >
                {preset.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.resetButton}
        onPress={() => {
          Alert.alert('Reset Filters', 'This will clear all active filters. Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: resetDailyFilters },
          ]);
        }}
      >
        <Text style={styles.resetButtonText}>Reset All Filters</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Filter Summary Component
 */
export const FilterSummary: React.FC = () => {
  const { getDailyFilterCount, hasDailyFilters } = useFilterStore();

  if (!hasDailyFilters()) {
    return null;
  }

  return (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryText}>
        {getDailyFilterCount()} filter{getDailyFilterCount() !== 1 ? 's' : ''} active
      </Text>
    </View>
  );
};

// Styles for filter components
const styles = StyleSheet.create({
  filterSection: {
    marginBottom: 32,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  filterSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  filterTitleRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  filterActions: {
    flexDirection: 'row' as const,
    marginHorizontal: 6,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.gray200,
    borderRadius: 16,
  },
  actionButtonText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500' as const,
  },

  // Price range styles
  priceRangeContainer: {
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: theme.colors.primary,
  },
  sliderContainer: {
    marginVertical: 8,
  },
  sliderLabels: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  sliderRow: {
    flexDirection: 'row' as const,
    marginHorizontal: 4,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    backgroundColor: theme.colors.primary,
  },

  // Checkbox styles
  checkboxGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: 6,
  },
  checkboxItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.gray200,
    marginHorizontal: 4,
  },
  checkboxItemSelected: {
    backgroundColor: theme.colors.primary + '20',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.gray200,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checkboxSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  checkboxCheck: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  checkboxLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  checkboxLabelSelected: {
    color: theme.colors.primary,
    fontWeight: '500' as const,
  },

  // Toggle styles
  toggleList: {
    marginHorizontal: 8,
  },
  toggleItem: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.gray100,
    borderRadius: 8,
    marginBottom: 8,
  },
  toggleLabel: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  toggleIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  toggleText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
  },

  // Spice level styles
  spiceLevelContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginTop: 12,
  },
  spiceLevelItem: {
    alignItems: 'center' as const,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.gray200,
    minWidth: 60,
  },
  spiceLevelSelected: {
    backgroundColor: theme.colors.primary + '20',
  },
  spiceIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  spiceLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
  },
  spiceLabelSelected: {
    color: theme.colors.primary,
    fontWeight: '500' as const,
  },

  // Calorie range styles
  calorieContainer: {
    marginTop: 12,
  },
  calorieLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 12,
  },

  // Preset styles
  presetGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: 6,
    marginBottom: 20,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.gray200,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    marginRight: 8,
    marginBottom: 8,
  },
  presetButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  presetButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500' as const,
  },
  presetButtonTextActive: {
    color: theme.colors.white,
  },
  resetButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.error + '20',
    borderWidth: 1,
    borderColor: theme.colors.error,
    alignItems: 'center' as const,
  },
  resetButtonText: {
    color: theme.colors.error,
    fontWeight: '500' as const,
  },

  // Summary styles
  summaryContainer: {
    padding: 12,
    backgroundColor: theme.colors.primary + '10',
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
});
