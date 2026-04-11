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
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, PanResponder } from 'react-native';
import { useFilterStore, DailyFilters, defaultDailyFilters } from '../../stores/filterStore';
import { ViewModeToggle } from './ViewModeToggle';
import { modals } from '@/styles';
import { colors, spacing, typography, borderRadius } from '@eatme/tokens';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/i18nUtils';
import { POPULAR_CUISINES, ALL_CUISINES } from '../../constants';

/**
 * Converts a display name like "Comfort Food" or "Fish & Chips" to the
 * camelCase locale key used in the JSON files ("comfortFood", "fishAndChips").
 */
const toLocaleKey = (str: string): string => {
  const normalized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: Café → Cafe
    .replace(/&/g, 'And'); // Fish & Chips → Fish And Chips
  const words = normalized.trim().split(/\s+/);
  return (
    words[0].toLowerCase() +
    words
      .slice(1)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('')
  );
};

interface DailyFilterModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DailyFilterModal: React.FC<DailyFilterModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const replaceDailyFilters = useFilterStore(state => state.replaceDailyFilters);
  // Read the current applied daily filters once so the modal opens showing them.
  const currentDaily = useFilterStore(state => state.daily);

  // Local state — initialised from the currently applied filters each time the modal opens.
  // Changes here don’t affect the feed until the user presses Apply.
  const [localFilters, setLocalFilters] = React.useState<DailyFilters>({ ...currentDaily });
  const [cuisineModalVisible, setCuisineModalVisible] = React.useState(false);
  const [mealModalVisible, setMealModalVisible] = React.useState(false);
  const [sliderDragging, setSliderDragging] = React.useState(false);

  // Sync to current applied state each time the modal becomes visible
  React.useEffect(() => {
    if (visible) {
      setLocalFilters({ ...currentDaily });
    }
  }, [visible]); // intentionally only on open; currentDaily not in deps

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

          {/* View Mode Toggle */}
          <ViewModeToggle style={modals.viewModeToggleContainer} />

          <ScrollView
            style={modals.content}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEnabled={!sliderDragging}
          >
            {/* 1. Price Range Section - Dual Slider */}
            <View style={[modals.section, { marginTop: -20 }]}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>
                💰 {t('filters.priceRange')}
              </Text>
              <View style={modals.priceSliderContainer}>
                <View style={modals.priceSliderLabels}>
                  <Text style={[modals.priceSliderLabel, modals.darkPriceLabel]}>
                    {localFilters.priceRange.min === 10
                      ? `${t('filters.lessThan')} ${formatCurrency(10)}`
                      : formatCurrency(localFilters.priceRange.min)}
                  </Text>
                  <Text style={[modals.priceSliderLabel, modals.darkPriceLabel]}>
                    {localFilters.priceRange.max === 50
                      ? `${t('filters.over')} ${formatCurrency(50)}`
                      : formatCurrency(localFilters.priceRange.max)}
                  </Text>
                </View>
                <DualRangeSlider
                  min={10}
                  max={50}
                  valueMin={localFilters.priceRange.min}
                  valueMax={localFilters.priceRange.max}
                  onValuesChange={(min, max) =>
                    setLocalFilters(prev => ({ ...prev, priceRange: { min, max } }))
                  }
                  onDragStateChange={setSliderDragging}
                />
              </View>
            </View>

            {/* 2. Diet Preference Section */}
            <View style={modals.section}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>
                🥗 {t('filters.dietPreferences')}
              </Text>

              {/* Diet Type Tabs - COMMENTED OUT */}
              {/* <View style={modals.tabContainer}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'vegetarian', label: 'Vegetarian' },
                  { key: 'vegan', label: 'Vegan' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[modals.tab, daily.dietPreference === option.key && modals.selectedTab]}
                    onPress={() => setDietPreference(option.key as keyof typeof daily.dietPreference)}
                  >
                    <Text
                      style={[
                        modals.tabText,
                        modals.darkTabText,
                        daily.dietPreference === option.key && modals.selectedTabText,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View> */}

              {/* Protein Options */}
              <View style={modals.multiOptionContainer}>
                <View style={modals.optionsRow}>
                  {[
                    { key: 'meat', label: t('filters.proteinTypes.meat') },
                    { key: 'fish', label: t('filters.proteinTypes.fish') },
                    { key: 'seafood', label: t('filters.proteinTypes.seafood') },
                    { key: 'egg', label: t('filters.proteinTypes.egg') },
                    { key: 'vegetarian', label: t('filters.proteinTypes.vegetarian') },
                    { key: 'vegan', label: t('filters.proteinTypes.vegan') },
                  ].map(protein => {
                    const isSelected =
                      protein.key === 'vegetarian'
                        ? localFilters.dietPreference.vegetarian
                        : protein.key === 'vegan'
                          ? localFilters.dietPreference.vegan
                          : localFilters.proteinTypes[
                              protein.key as keyof typeof localFilters.proteinTypes
                            ];

                    return (
                      <TouchableOpacity
                        key={protein.key}
                        style={[modals.option, isSelected && modals.selectedOption]}
                        onPress={() => {
                          if (protein.key === 'vegetarian') {
                            setLocalFilters(prev => ({
                              ...prev,
                              dietPreference: {
                                ...prev.dietPreference,
                                vegetarian: !prev.dietPreference.vegetarian,
                              },
                            }));
                          } else if (protein.key === 'vegan') {
                            setLocalFilters(prev => ({
                              ...prev,
                              dietPreference: {
                                ...prev.dietPreference,
                                vegan: !prev.dietPreference.vegan,
                              },
                            }));
                          } else {
                            // Selecting a protein type resets diet preferences and toggles the protein
                            setLocalFilters(prev => ({
                              ...prev,
                              dietPreference: { vegetarian: false, vegan: false },
                              proteinTypes: {
                                ...prev.proteinTypes,
                                [protein.key]:
                                  !prev.proteinTypes[protein.key as keyof typeof prev.proteinTypes],
                              },
                              // When selecting Meat: pre-select Chicken, Beef, Pork.
                              // When deselecting Meat: clear all meat sub-types.
                              ...(protein.key === 'meat' && {
                                meatTypes: prev.proteinTypes.meat
                                  ? {
                                      chicken: false,
                                      beef: false,
                                      pork: false,
                                      lamb: false,
                                      duck: false,
                                      other: false,
                                    }
                                  : {
                                      chicken: true,
                                      beef: true,
                                      pork: true,
                                      lamb: false,
                                      duck: false,
                                      other: false,
                                    },
                              }),
                            }));
                          }
                        }}
                      >
                        <Text
                          style={[
                            modals.optionText,
                            modals.darkOptionText,
                            isSelected && modals.selectedText,
                          ]}
                        >
                          {protein.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Meat sub-types — shown only when Meat is selected */}
                {localFilters.proteinTypes.meat && (
                  <View style={[modals.optionsRow, { marginTop: 8 }]}>
                    {[
                      { key: 'chicken', label: t('filters.meatTypes.chicken') },
                      { key: 'beef', label: t('filters.meatTypes.beef') },
                      { key: 'pork', label: t('filters.meatTypes.pork') },
                      { key: 'lamb', label: t('filters.meatTypes.lamb') },
                      { key: 'duck', label: t('filters.meatTypes.duck') },
                      { key: 'other', label: t('filters.meatTypes.other') },
                    ].map(meatType => {
                      const isSelected =
                        localFilters.meatTypes[meatType.key as keyof typeof localFilters.meatTypes];
                      return (
                        <TouchableOpacity
                          key={meatType.key}
                          style={[modals.option, isSelected && modals.selectedOption]}
                          onPress={() =>
                            setLocalFilters(prev => ({
                              ...prev,
                              meatTypes: {
                                ...prev.meatTypes,
                                [meatType.key]:
                                  !prev.meatTypes[meatType.key as keyof typeof prev.meatTypes],
                              },
                            }))
                          }
                        >
                          <Text
                            style={[
                              modals.optionText,
                              modals.darkOptionText,
                              isSelected && modals.selectedText,
                            ]}
                          >
                            {meatType.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
            <View style={modals.section}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>
                🍽️ {t('filters.cuisine')}
              </Text>
              <View style={modals.cuisineGrid}>
                {POPULAR_CUISINES.map(cuisine => (
                  <TouchableOpacity
                    key={cuisine}
                    style={[
                      modals.cuisineOption,
                      localFilters.cuisineTypes.includes(cuisine) && modals.selectedOption,
                    ]}
                    onPress={() =>
                      setLocalFilters(prev => ({
                        ...prev,
                        cuisineTypes: prev.cuisineTypes.includes(cuisine)
                          ? prev.cuisineTypes.filter(c => c !== cuisine)
                          : [...prev.cuisineTypes, cuisine],
                      }))
                    }
                  >
                    <Text
                      style={[
                        modals.cuisineText,
                        modals.darkCuisineText,
                        localFilters.cuisineTypes.includes(cuisine) && modals.selectedText,
                      ]}
                    >
                      {t(`filters.cuisines.${toLocaleKey(cuisine)}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={modals.cuisineOption}
                  onPress={() => setCuisineModalVisible(true)}
                >
                  <Text style={[modals.cuisineText, modals.darkCuisineText]}>
                    {t('common.other')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3.5. Dish / Meal Section */}
            <View style={modals.section}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>
                🍔 {t('filters.meal')}
              </Text>
              <View style={modals.cuisineGrid}>
                {[
                  'Tacos',
                  'Pizza',
                  'Burger',
                  'Pasta',
                  'Sushi',
                  'Salad',
                  'Steak',
                  'Ramen',
                  'Sandwich',
                  'Curry',
                  'Burrito',
                ].map(meal => (
                  <TouchableOpacity
                    key={meal}
                    style={[
                      modals.cuisineOption,
                      localFilters.meals.includes(meal) && modals.selectedOption,
                    ]}
                    onPress={() =>
                      setLocalFilters(prev => ({
                        ...prev,
                        meals: prev.meals.includes(meal)
                          ? prev.meals.filter(m => m !== meal)
                          : [...prev.meals, meal],
                      }))
                    }
                  >
                    <Text
                      style={[
                        modals.cuisineText,
                        modals.darkCuisineText,
                        localFilters.meals.includes(meal) && modals.selectedText,
                      ]}
                    >
                      {t(`filters.meals.${toLocaleKey(meal)}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={modals.cuisineOption}
                  onPress={() => setMealModalVisible(true)}
                >
                  <Text style={[modals.cuisineText, modals.darkCuisineText]}>
                    {t('common.other')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Cuisine Selection Modal */}
      <CuisineSelectionModal
        visible={cuisineModalVisible}
        onClose={() => setCuisineModalVisible(false)}
        selectedCuisines={localFilters.cuisineTypes}
        onToggleCuisine={cuisine =>
          setLocalFilters(prev => ({
            ...prev,
            cuisineTypes: prev.cuisineTypes.includes(cuisine)
              ? prev.cuisineTypes.filter(c => c !== cuisine)
              : [...prev.cuisineTypes, cuisine],
          }))
        }
      />

      {/* Meal Selection Modal */}
      <MealSelectionModal
        visible={mealModalVisible}
        onClose={() => setMealModalVisible(false)}
        selectedMeals={localFilters.meals}
        onToggleMeal={meal =>
          setLocalFilters(prev => ({
            ...prev,
            meals: prev.meals.includes(meal)
              ? prev.meals.filter(m => m !== meal)
              : [...prev.meals, meal],
          }))
        }
      />
    </Modal>
  );
};

// Full list used in the Meal Selection Modal
const ALL_MEALS: string[] = [
  'Tacos',
  'Pizza',
  'Burger',
  'Pasta',
  'Sushi',
  'Salad',
  'Steak',
  'Ramen',
  'Sandwich',
  'Curry',
  'Burrito',
  'Noodles',
  'Rice Bowl',
  'Soup',
  'BBQ',
  'Wings',
  'Kebab',
  'Pho',
  'Pad Thai',
  'Dumplings',
  'Fried Chicken',
  'Falafel',
  'Gyros',
  'Quesadilla',
  'Nachos',
  'Tostadas',
  'Enchiladas',
  'Bento Box',
  'Bibimbap',
  'Paella',
  'Risotto',
  'Gnocchi',
  'Lasagna',
  'Fettuccine',
  'Poke Bowl',
  'Spring Rolls',
  'Tempura',
  'Udon',
  'Soba',
  'Biryani',
  'Tikka Masala',
  'Vindaloo',
  'Shawarma',
  'Schnitzel',
  'Fish & Chips',
  'Hot Dog',
  'Philly Cheesesteak',
  'Club Sandwich',
  'Banh Mi',
  'Croissant',
  'Bagel',
  'Pancakes',
  'Waffles',
  'Omelette',
  'Breakfast Burrito',
  'French Toast',
  'Eggs Benedict',
  'Huevos Rancheros',
  'Chilaquiles',
];

/**
 * Meal Selection Modal Component
 *
 * A modal for selecting specific dishes/meals beyond the popular options
 */
interface MealSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMeals: string[];
  onToggleMeal: (meal: string) => void;
}

const MealSelectionModal: React.FC<MealSelectionModalProps> = ({
  visible,
  onClose,
  selectedMeals,
  onToggleMeal,
}) => {
  const { t } = useTranslation();
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={modals.overlay}>
        <View style={[modals.container, modals.darkContainer, { maxHeight: '80%' }]}>
          <View style={modals.header}>
            <Text style={[modals.title, modals.darkTitle]}>🍔 {t('filters.selectMeals')}</Text>
            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.base,
                backgroundColor: colors.accent,
              }}
              onPress={onClose}
            >
              <Text
                style={{
                  fontSize: typography.size.sm,
                  color: colors.white,
                  fontWeight: typography.weight.semibold,
                }}
              >
                {t('common.done')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={modals.content} showsVerticalScrollIndicator={true}>
            <View style={modals.cuisineGrid}>
              {ALL_MEALS.map(meal => (
                <TouchableOpacity
                  key={meal}
                  style={[
                    modals.cuisineOption,
                    selectedMeals.includes(meal) && modals.selectedOption,
                  ]}
                  onPress={() => onToggleMeal(meal)}
                >
                  <Text
                    style={[
                      modals.cuisineText,
                      modals.darkCuisineText,
                      selectedMeals.includes(meal) && modals.selectedText,
                    ]}
                  >
                    {t(`filters.meals.${toLocaleKey(meal)}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Cuisine Selection Modal Component
 *
 * A modal for selecting cuisines beyond the popular options
 */
interface CuisineSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCuisines: string[];
  onToggleCuisine: (cuisine: string) => void;
}

const CuisineSelectionModal: React.FC<CuisineSelectionModalProps> = ({
  visible,
  onClose,
  selectedCuisines,
  onToggleCuisine,
}) => {
  const { t } = useTranslation();
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={modals.overlay}>
        <View style={[modals.container, modals.darkContainer, { maxHeight: '80%' }]}>
          <View style={modals.header}>
            <Text style={[modals.title, modals.darkTitle]}>🍽️ {t('filters.selectCuisines')}</Text>
            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.base,
                backgroundColor: colors.accent,
              }}
              onPress={onClose}
            >
              <Text
                style={{
                  fontSize: typography.size.sm,
                  color: colors.white,
                  fontWeight: typography.weight.semibold,
                }}
              >
                {t('common.done')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={modals.content} showsVerticalScrollIndicator={true}>
            <View style={modals.cuisineGrid}>
              {ALL_CUISINES.map(cuisine => (
                <TouchableOpacity
                  key={cuisine}
                  style={[
                    modals.cuisineOption,
                    selectedCuisines.includes(cuisine) && modals.selectedOption,
                  ]}
                  onPress={() => onToggleCuisine(cuisine)}
                >
                  <Text
                    style={[
                      modals.cuisineText,
                      modals.darkCuisineText,
                      selectedCuisines.includes(cuisine) && modals.selectedText,
                    ]}
                  >
                    {t(`filters.cuisines.${toLocaleKey(cuisine)}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Dual Range Slider Component
 *
 * A custom dual-thumb slider for selecting price ranges
 */
interface DualRangeSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onValuesChange: (min: number, max: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min,
  max,
  valueMin,
  valueMax,
  onValuesChange,
  onDragStateChange,
}) => {
  const [activeThumb, setActiveThumb] = React.useState<'min' | 'max' | null>(null);

  // trackWidth drives pixel-based positioning so percentage left values
  // (which break on Android physical devices) are never used.
  const [trackWidth, setTrackWidth] = React.useState(0);
  const trackWidthRef = React.useRef(0);

  // Keep fresh refs for PanResponder closures so they always see current values
  const valueMinRef = React.useRef(valueMin);
  const valueMaxRef = React.useRef(valueMax);
  React.useEffect(() => {
    valueMinRef.current = valueMin;
  }, [valueMin]);
  React.useEffect(() => {
    valueMaxRef.current = valueMax;
  }, [valueMax]);

  const clamp = (val: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, val));

  // Factory: creates a PanResponder for either the min or max thumb.
  const createThumbPanResponder = (thumb: 'min' | 'max') => {
    let startValue = min;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        startValue = thumb === 'min' ? valueMinRef.current : valueMaxRef.current;
        setActiveThumb(thumb);
        onDragStateChange?.(true);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (trackWidthRef.current === 0) return;
        const deltaValue = (gestureState.dx / trackWidthRef.current) * (max - min);
        const newValue = Math.round(clamp(startValue + deltaValue, min, max));
        if (thumb === 'min') {
          onValuesChange(clamp(newValue, min, valueMaxRef.current - 1), valueMaxRef.current);
        } else {
          onValuesChange(valueMinRef.current, clamp(newValue, valueMinRef.current + 1, max));
        }
      },
      onPanResponderRelease: () => { setActiveThumb(null); onDragStateChange?.(false); },
      onPanResponderTerminate: () => { setActiveThumb(null); onDragStateChange?.(false); },
    });
  };

  const minPanResponder = React.useRef(createThumbPanResponder('min')).current;
  const maxPanResponder = React.useRef(createThumbPanResponder('max')).current;

  // Pixel positions — avoid percentage-based left values which don't resolve
  // correctly on Android physical devices when parent width is from flex layout.
  const minLeft = trackWidth > 0 ? ((valueMin - min) / (max - min)) * trackWidth : 0;
  const maxLeft = trackWidth > 0 ? ((valueMax - min) / (max - min)) * trackWidth : trackWidth;

  return (
    <View
      style={modals.priceSliderWrapper}
      collapsable={false}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) {
          trackWidthRef.current = w;
          setTrackWidth(w);
        }
      }}
    >
      {/* Visual track bar */}
      <View style={modals.priceSliderTrack} />
      {/* Active range highlight */}
      <View
        style={[
          modals.priceSliderActiveRange,
          { left: minLeft, width: maxLeft - minLeft },
        ]}
      />
      {/* Min thumb — left is offset by half the thumb width (12) so the centre
          aligns with the value position. Direct subtraction avoids transform,
          which shifts pixels but NOT the touch area on older Android. */}
      <View
        style={[
          modals.priceSliderThumb,
          {
            left: minLeft - 12,
            zIndex: activeThumb === 'min' ? 10 : 5,
            elevation: activeThumb === 'min' ? 6 : 3,
          },
        ]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        {...minPanResponder.panHandlers}
      />
      {/* Max thumb */}
      <View
        style={[
          modals.priceSliderThumb,
          {
            left: maxLeft - 12,
            zIndex: activeThumb === 'max' ? 10 : 5,
            elevation: activeThumb === 'max' ? 6 : 3,
          },
        ]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        {...maxPanResponder.panHandlers}
      />
    </View>
  );
};
