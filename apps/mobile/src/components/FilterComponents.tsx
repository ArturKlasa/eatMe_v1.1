/**
 * Filter UI Components
 *
 * Comprehensive filter components for restaurant and dish filtering.
 * Includes price range, cuisine selection, dietary restrictions, and more.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import Slider from 'react-native-slider';
import { useFilterStore, DAILY_FILTER_PRESETS } from '../stores/filterStore';
import { commonStyles, theme, filterComponentsStyles } from '@/styles';

// Available cuisine types - synced with web portal
const CUISINE_TYPES = [
  'Afghan',
  'African',
  'American',
  'Argentine',
  'Asian',
  'BBQ',
  'Bakery',
  'Brazilian',
  'British',
  'Café',
  'Cajun',
  'Caribbean',
  'Chinese',
  'Colombian',
  'Comfort Food',
  'Cuban',
  'Deli',
  'Ethiopian',
  'Fast Food',
  'Filipino',
  'Fine Dining',
  'French',
  'Fusion',
  'German',
  'Greek',
  'Halal',
  'Hawaiian',
  'Healthy',
  'Indian',
  'Indonesian',
  'International',
  'Irish',
  'Italian',
  'Jamaican',
  'Japanese',
  'Korean',
  'Kosher',
  'Latin American',
  'Lebanese',
  'Malaysian',
  'Mediterranean',
  'Mexican',
  'Middle Eastern',
  'Moroccan',
  'Nepalese',
  'Pakistani',
  'Peruvian',
  'Pizza',
  'Polish',
  'Portuguese',
  'Russian',
  'Salad',
  'Sandwiches',
  'Seafood',
  'Soul Food',
  'Southern',
  'Spanish',
  'Steakhouse',
  'Sushi',
  'Tapas',
  'Thai',
  'Turkish',
  'Vegan',
  'Vegetarian',
  'Vietnamese',
  'Other',
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
    <View style={filterComponentsStyles.filterSection}>
      <Text style={filterComponentsStyles.filterTitle}>💰 Price Range</Text>
      <View style={filterComponentsStyles.priceRangeContainer}>
        <Text style={filterComponentsStyles.priceLabel}>
          {PRICE_LABELS[daily.priceRange.min - 1]} - {PRICE_LABELS[daily.priceRange.max - 1]}
        </Text>
      </View>

      {/* Custom dual slider implementation */}
      <View style={filterComponentsStyles.sliderContainer}>
        <View style={filterComponentsStyles.sliderLabels}>
          {PRICE_LABELS.map((label, index) => (
            <Text key={index} style={filterComponentsStyles.sliderLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={filterComponentsStyles.sliderRow}>
          <Slider
            style={filterComponentsStyles.slider}
            minimumValue={1}
            maximumValue={4}
            value={daily.priceRange.min}
            onValueChange={value => setDailyPriceRange(Math.round(value), daily.priceRange.max)}
            step={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.gray200}
            thumbStyle={filterComponentsStyles.sliderThumb}
          />
          <Slider
            style={filterComponentsStyles.slider}
            minimumValue={1}
            maximumValue={4}
            value={daily.priceRange.max}
            onValueChange={value => setDailyPriceRange(daily.priceRange.min, Math.round(value))}
            step={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.gray200}
            thumbStyle={filterComponentsStyles.sliderThumb}
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
    <View style={filterComponentsStyles.filterSection}>
      <View style={filterComponentsStyles.filterTitleRow}>
        <Text style={filterComponentsStyles.filterTitle}>🍽️ Cuisine Types</Text>
        <View style={filterComponentsStyles.filterActions}>
          <TouchableOpacity onPress={clearAllCuisines} style={filterComponentsStyles.actionButton}>
            <Text style={filterComponentsStyles.actionButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={selectAllCuisines} style={filterComponentsStyles.actionButton}>
            <Text style={filterComponentsStyles.actionButtonText}>All</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={filterComponentsStyles.checkboxGrid}>
        {CUISINE_TYPES.map(cuisine => (
          <TouchableOpacity
            key={cuisine}
            style={[
              filterComponentsStyles.checkboxItem,
              daily.cuisineTypes.includes(cuisine) && filterComponentsStyles.checkboxItemSelected,
            ]}
            onPress={() => toggleDailyCuisine(cuisine)}
          >
            <View
              style={[
                filterComponentsStyles.checkbox,
                daily.cuisineTypes.includes(cuisine) && filterComponentsStyles.checkboxSelected,
              ]}
            >
              {daily.cuisineTypes.includes(cuisine) && (
                <Text style={filterComponentsStyles.checkboxCheck}>✓</Text>
              )}
            </View>
            <Text
              style={[
                filterComponentsStyles.checkboxLabel,
                daily.cuisineTypes.includes(cuisine) &&
                  filterComponentsStyles.checkboxLabelSelected,
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
    <View style={filterComponentsStyles.filterSection}>
      <Text style={filterComponentsStyles.filterTitle}>🍽️ Diet Options</Text>

      {/* Diet Preference Selection */}
      <View style={filterComponentsStyles.toggleList}>
        <Text style={filterComponentsStyles.filterSubtitle}>Diet Preference</Text>
        {dietPreferenceOptions.map(option => (
          <TouchableOpacity
            key={option.key}
            style={[
              filterComponentsStyles.toggleItem,
              daily.dietPreference === option.key && { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => setDietPreference(option.key as any)}
          >
            <Text
              style={[
                filterComponentsStyles.toggleText,
                daily.dietPreference === option.key && { color: theme.colors.white },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Protein Types */}
      <View style={filterComponentsStyles.toggleList}>
        <Text style={filterComponentsStyles.filterSubtitle}>Protein Types</Text>
        {proteinOptions.map(option => (
          <View key={option.key} style={filterComponentsStyles.toggleItem}>
            <View style={filterComponentsStyles.toggleLabel}>
              <Text style={filterComponentsStyles.toggleIcon}>{option.icon}</Text>
              <Text style={filterComponentsStyles.toggleText}>{option.label}</Text>
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
    <View style={filterComponentsStyles.filterSection}>
      <View style={filterComponentsStyles.filterTitleRow}>
        <Text style={filterComponentsStyles.filterTitle}>🔥 Calorie Range</Text>
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
        <View style={filterComponentsStyles.calorieContainer}>
          <Text style={filterComponentsStyles.calorieLabel}>
            {daily.calorieRange.min} - {daily.calorieRange.max} calories
          </Text>

          <View style={filterComponentsStyles.sliderContainer}>
            <Slider
              style={filterComponentsStyles.slider}
              minimumValue={0}
              maximumValue={2000}
              value={daily.calorieRange.min}
              onValueChange={value =>
                setDailyCalorieRange(Math.round(value), daily.calorieRange.max, true)
              }
              step={50}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.gray200}
              thumbStyle={filterComponentsStyles.sliderThumb}
            />
            <Slider
              style={filterComponentsStyles.slider}
              minimumValue={0}
              maximumValue={2000}
              value={daily.calorieRange.max}
              onValueChange={value =>
                setDailyCalorieRange(daily.calorieRange.min, Math.round(value), true)
              }
              step={50}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.gray200}
              thumbStyle={filterComponentsStyles.sliderThumb}
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
    <View style={filterComponentsStyles.filterSection}>
      <Text style={filterComponentsStyles.filterTitle}>⚡ Quick Filters</Text>

      <View style={filterComponentsStyles.presetGrid}>
        {presetKeys.map(presetKey => {
          const preset = DAILY_FILTER_PRESETS[presetKey as keyof typeof DAILY_FILTER_PRESETS];
          return (
            <TouchableOpacity
              key={presetKey}
              style={[
                filterComponentsStyles.presetButton,
                activePreset === presetKey && filterComponentsStyles.presetButtonActive,
              ]}
              onPress={() => applyPreset(presetKey)}
            >
              <Text
                style={[
                  filterComponentsStyles.presetButtonText,
                  activePreset === presetKey && filterComponentsStyles.presetButtonTextActive,
                ]}
              >
                {preset.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={filterComponentsStyles.resetButton}
        onPress={() => {
          Alert.alert('Reset Filters', 'This will clear all active filters. Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: resetDailyFilters },
          ]);
        }}
      >
        <Text style={filterComponentsStyles.resetButtonText}>Reset All Filters</Text>
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
    <View style={filterComponentsStyles.summaryContainer}>
      <Text style={filterComponentsStyles.summaryText}>
        {getDailyFilterCount()} filter{getDailyFilterCount() !== 1 ? 's' : ''} active
      </Text>
    </View>
  );
};
