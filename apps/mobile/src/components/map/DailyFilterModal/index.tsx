/**
 * Daily Filter Modal Component
 *
 * A comprehensive modal for daily restaurant filtering with:
 * - Price range slider ($10-$50)
 * - Diet preferences (All/Vegetarian/Vegan) with protein options
 * - Cuisine selection with grid layout
 * - Hunger level selection (diet/normal/starving)
 *
 * Note: Meat sub-types row expands when Meat is selected
 *
 * Parent composition root + barrel. Owns the `localFilters` draft + ALL
 * reducer logic; the section children are pure presentational value+onChange
 * components (D-01/D-03). Edits stay local until Apply, which commits once via
 * replaceDailyFilters.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useFilterStore, DailyFilters } from '../../../stores/filterStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { getCurrencyInfo } from '../../../utils/currencyConfig';
import { modals } from '@/styles';
import { colors, spacing, typography, borderRadius } from '@eatme/tokens';
import { useTranslation } from 'react-i18next';
import { PriceSection } from './sections/PriceSection';
import { ProteinSection } from './sections/ProteinSection';
import { CuisineSection } from './sections/CuisineSection';
import { MealSection } from './sections/MealSection';
import { CuisineSelectionModal } from './modals/CuisineSelectionModal';
import { MealSelectionModal } from './modals/MealSelectionModal';

interface DailyFilterModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DailyFilterModal: React.FC<DailyFilterModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const replaceDailyFilters = useFilterStore(state => state.replaceDailyFilters);
  // Read the current applied daily filters once so the modal opens showing them.
  const currentDaily = useFilterStore(state => state.daily);
  const currency = useSettingsStore(state => state.currency);
  const currencyInfo = getCurrencyInfo(currency);
  const { min: priceMin, max: priceMax, step: priceStep } = currencyInfo.priceRange;

  // Local state — initialised from the currently applied filters each time the modal opens.
  // Changes here don’t affect the feed until the user presses Apply.
  const [localFilters, setLocalFilters] = React.useState<DailyFilters>({ ...currentDaily });
  const [cuisineModalVisible, setCuisineModalVisible] = React.useState(false);
  const [mealModalVisible, setMealModalVisible] = React.useState(false);
  const [sliderDragging, setSliderDragging] = React.useState(false);

  // LANDMINE — do NOT add currentDaily to deps; clobbers in-progress edits. See 09-CONTEXT.md D-11.2
  // Sync to current applied state each time the modal becomes visible
  React.useEffect(() => {
    if (visible) {
      setLocalFilters({ ...currentDaily });
    }
  }, [visible]); // intentionally only on open; currentDaily not in deps

  // LANDMINE — protein/meat special-casing; preserve branch logic exactly. See 09-CONTEXT.md D-11.3
  const onToggleProtein = (key: string) => {
    if (key === 'vegetarian') {
      setLocalFilters(prev => ({
        ...prev,
        dietPreference: prev.dietPreference === 'vegetarian' ? 'all' : 'vegetarian',
      }));
    } else if (key === 'vegan') {
      setLocalFilters(prev => ({
        ...prev,
        dietPreference: prev.dietPreference === 'vegan' ? 'all' : 'vegan',
      }));
    } else {
      // Selecting a protein type resets diet preference and toggles the protein
      setLocalFilters(prev => ({
        ...prev,
        dietPreference: 'all',
        proteinTypes: {
          ...prev.proteinTypes,
          [key]: !prev.proteinTypes[key as keyof typeof prev.proteinTypes],
        },
        // When selecting Meat: pre-select Chicken, Beef, Pork.
        // When deselecting Meat: clear all meat sub-types.
        ...(key === 'meat' && {
          meatTypes: prev.proteinTypes.meat
            ? {
                chicken: false,
                beef: false,
                pork: false,
                lamb: false,
                goat: false,
                other: false,
              }
            : {
                chicken: true,
                beef: true,
                pork: true,
                lamb: false,
                goat: false,
                other: false,
              },
        }),
      }));
    }
  };

  const onToggleMeat = (key: string) =>
    setLocalFilters(prev => ({
      ...prev,
      meatTypes: {
        ...prev.meatTypes,
        [key]: !prev.meatTypes[key as keyof typeof prev.meatTypes],
      },
    }));

  const onToggleCuisine = (cuisine: string) =>
    setLocalFilters(prev => ({
      ...prev,
      cuisineTypes: prev.cuisineTypes.includes(cuisine)
        ? prev.cuisineTypes.filter(c => c !== cuisine)
        : [...prev.cuisineTypes, cuisine],
    }));

  const onToggleMeal = (meal: string) =>
    setLocalFilters(prev => ({
      ...prev,
      meals: prev.meals.includes(meal) ? prev.meals.filter(m => m !== meal) : [...prev.meals, meal],
    }));

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={modals.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={[modals.container, modals.darkContainer]}
          activeOpacity={1}
          onPress={e => e.stopPropagation()}
        >
          <View
            style={[
              modals.header,
              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
            ]}
          >
            <Text style={[modals.title, modals.darkTitle]}>{t('filters.dailyFilters')}</Text>
            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.base,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                replaceDailyFilters(localFilters);
                onClose();
              }}
            >
              <Text
                style={{
                  fontSize: typography.size.sm,
                  color: colors.white,
                  fontWeight: typography.weight.semibold,
                }}
              >
                {t('common.apply')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={modals.content}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEnabled={!sliderDragging}
          >
            {/* 1. Price Range Section - Dual Slider */}
            <PriceSection
              valueMin={localFilters.priceRange.min}
              valueMax={localFilters.priceRange.max}
              priceMin={priceMin}
              priceMax={priceMax}
              priceStep={priceStep}
              currency={currency}
              onValuesChange={(min, max) =>
                setLocalFilters(prev => ({ ...prev, priceRange: { min, max } }))
              }
              onDragStateChange={setSliderDragging}
            />

            {/* 2. Diet Preference Section */}
            <ProteinSection
              value={{
                dietPreference: localFilters.dietPreference,
                proteinTypes: localFilters.proteinTypes,
                meatTypes: localFilters.meatTypes,
              }}
              onToggleProtein={onToggleProtein}
              onToggleMeat={onToggleMeat}
            />

            {/* 3. Cuisine Section */}
            <CuisineSection
              cuisineTypes={localFilters.cuisineTypes}
              onToggleCuisine={onToggleCuisine}
              onOpenAll={() => setCuisineModalVisible(true)}
            />

            {/* 3.5. Dish / Meal Section */}
            <MealSection
              meals={localFilters.meals}
              onToggleMeal={onToggleMeal}
              onOpenAll={() => setMealModalVisible(true)}
            />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Cuisine Selection Modal */}
      <CuisineSelectionModal
        visible={cuisineModalVisible}
        onClose={() => setCuisineModalVisible(false)}
        selectedCuisines={localFilters.cuisineTypes}
        onToggleCuisine={onToggleCuisine}
      />

      {/* Meal Selection Modal */}
      <MealSelectionModal
        visible={mealModalVisible}
        onClose={() => setMealModalVisible(false)}
        selectedMeals={localFilters.meals}
        onToggleMeal={onToggleMeal}
      />
    </Modal>
  );
};
