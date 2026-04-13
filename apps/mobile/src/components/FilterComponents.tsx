/**
 * Filter UI Components
 *
 * Comprehensive filter components for restaurant and dish filtering.
 * Includes price range, cuisine selection, dietary restrictions, and more.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';
import { useFilterStore, DAILY_FILTER_PRESETS, type DailyFilters } from '../stores/filterStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getCurrencyInfo, formatPrice } from '../utils/currencyConfig';
import { commonStyles, theme, filterComponentsStyles } from '@/styles';

const toLocaleKey = (str: string): string => {
  const normalized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'And');
  const words = normalized.trim().split(/\s+/);
  return (
    words[0].toLowerCase() +
    words
      .slice(1)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('')
  );
};

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
 *
 * Displays an actual-price slider (e.g. $10–$50, $100–$500 MXN)
 * using the currency detected from the device's region / GPS location.
 */
export const PriceRangeFilter: React.FC = () => {
  const { daily, setDailyPriceRange } = useFilterStore();
  const currency = useSettingsStore(state => state.currency);
  const currencyInfo = getCurrencyInfo(currency);
  const { step, sliderMax } = currencyInfo.priceRange;
  const { t } = useTranslation();

  return (
    <View style={filterComponentsStyles.filterSection}>
      <Text style={filterComponentsStyles.filterTitle}>💰 {t('filters.priceRange')}</Text>
      <View style={filterComponentsStyles.priceRangeContainer}>
        <Text style={filterComponentsStyles.priceLabel}>
          {formatPrice(daily.priceRange.min, currency)}
          {' – '}
          {formatPrice(daily.priceRange.max, currency)}
        </Text>
      </View>

      {/* Min price slider */}
      <View style={filterComponentsStyles.sliderContainer}>
        <View style={filterComponentsStyles.sliderLabels}>
          <Text style={filterComponentsStyles.sliderLabel}>{formatPrice(0, currency)}</Text>
          <Text style={filterComponentsStyles.sliderLabel}>{formatPrice(sliderMax, currency)}</Text>
        </View>

        <View style={filterComponentsStyles.sliderRow}>
          <Slider
            style={filterComponentsStyles.slider}
            minimumValue={0}
            maximumValue={sliderMax}
            value={daily.priceRange.min}
            onValueChange={(value: number) =>
              setDailyPriceRange(
                Math.round(value / step) * step,
                Math.max(daily.priceRange.max, Math.round(value / step) * step)
              )
            }
            step={step}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.gray200}
            thumbTintColor={theme.colors.primary}
          />
          <Slider
            style={filterComponentsStyles.slider}
            minimumValue={0}
            maximumValue={sliderMax}
            value={daily.priceRange.max}
            onValueChange={(value: number) =>
              setDailyPriceRange(
                Math.min(daily.priceRange.min, Math.round(value / step) * step),
                Math.round(value / step) * step
              )
            }
            step={step}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.gray200}
            thumbTintColor={theme.colors.primary}
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
  const { t } = useTranslation();

  const clearAllCuisines = () => {
    setDailyCuisines([]);
  };

  const selectAllCuisines = () => {
    setDailyCuisines([...CUISINE_TYPES]);
  };

  return (
    <View style={filterComponentsStyles.filterSection}>
      <View style={filterComponentsStyles.filterTitleRow}>
        <Text style={filterComponentsStyles.filterTitle}>🍽️ {t('filters.cuisineTypes')}</Text>
        <View style={filterComponentsStyles.filterActions}>
          <TouchableOpacity onPress={clearAllCuisines} style={filterComponentsStyles.actionButton}>
            <Text style={filterComponentsStyles.actionButtonText}>{t('common.clear')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={selectAllCuisines} style={filterComponentsStyles.actionButton}>
            <Text style={filterComponentsStyles.actionButtonText}>{t('common.all')}</Text>
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
              {t(`filters.cuisines.${toLocaleKey(cuisine)}`)}
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
  const { t } = useTranslation();

  const dietPreferenceOptions: Array<{ key: keyof DailyFilters['dietPreference']; label: string }> =
    [
      { key: 'vegetarian', label: t('filters.dietOption.vegetarian') },
      { key: 'vegan', label: t('filters.dietOption.vegan') },
    ];

  const proteinOptions: Array<{
    key: keyof DailyFilters['proteinTypes'];
    label: string;
    icon: string;
  }> = [
    { key: 'meat', label: t('filters.proteinLabel.meat'), icon: '🥩' },
    { key: 'fish', label: t('filters.proteinLabel.fish'), icon: '🐟' },
    { key: 'seafood', label: t('filters.proteinLabel.seafood'), icon: '🦐' },
  ];

  return (
    <View style={filterComponentsStyles.filterSection}>
      <Text style={filterComponentsStyles.filterTitle}>🍽️ {t('filters.dietOptions')}</Text>

      {/* Diet Preference Selection */}
      <View style={filterComponentsStyles.toggleList}>
        <Text style={filterComponentsStyles.filterSubtitle}>
          {t('filters.dietPreferenceSubtitle')}
        </Text>
        {dietPreferenceOptions.map(option => (
          <TouchableOpacity
            key={option.key}
            style={[
              filterComponentsStyles.toggleItem,
              daily.dietPreference[option.key as keyof typeof daily.dietPreference] && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            onPress={() => setDietPreference(option.key)}
          >
            <Text
              style={[
                filterComponentsStyles.toggleText,
                daily.dietPreference[option.key as keyof typeof daily.dietPreference] && {
                  color: theme.colors.white,
                },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Protein Types */}
      <View style={filterComponentsStyles.toggleList}>
        <Text style={filterComponentsStyles.filterSubtitle}>
          {t('filters.proteinTypesSubtitle')}
        </Text>
        {proteinOptions.map(option => (
          <View key={option.key} style={filterComponentsStyles.toggleItem}>
            <View style={filterComponentsStyles.toggleLabel}>
              <Text style={filterComponentsStyles.toggleIcon}>{option.icon}</Text>
              <Text style={filterComponentsStyles.toggleText}>{option.label}</Text>
            </View>
            <Switch
              value={daily.proteinTypes[option.key as keyof typeof daily.proteinTypes]}
              onValueChange={() => toggleProteinType(option.key)}
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
  const { t } = useTranslation();

  return (
    <View style={filterComponentsStyles.filterSection}>
      <View style={filterComponentsStyles.filterTitleRow}>
        <Text style={filterComponentsStyles.filterTitle}>🔥 {t('filters.calorieRange')}</Text>
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
            {t('filters.calories', { min: daily.calorieRange.min, max: daily.calorieRange.max })}
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
              thumbTintColor={theme.colors.primary}
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
              thumbTintColor={theme.colors.primary}
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
  const { t } = useTranslation();

  const presetKeys = Object.keys(DAILY_FILTER_PRESETS);

  return (
    <View style={filterComponentsStyles.filterSection}>
      <Text style={filterComponentsStyles.filterTitle}>⚡ {t('filters.quickFilters')}</Text>

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
                {t(`filters.presets.${presetKey}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={filterComponentsStyles.resetButton}
        onPress={() => {
          Alert.alert(t('filters.resetFiltersTitle'), t('filters.resetFiltersMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.reset'), style: 'destructive', onPress: resetDailyFilters },
          ]);
        }}
      >
        <Text style={filterComponentsStyles.resetButtonText}>{t('filters.resetAllFilters')}</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Filter Summary Component
 */
export const FilterSummary: React.FC = () => {
  const { getDailyFilterCount, hasDailyFilters } = useFilterStore();
  const { t } = useTranslation();

  if (!hasDailyFilters()) {
    return null;
  }

  return (
    <View style={filterComponentsStyles.summaryContainer}>
      <Text style={filterComponentsStyles.summaryText}>
        {t('filters.activeFilters', { count: getDailyFilterCount() })}
      </Text>
    </View>
  );
};
