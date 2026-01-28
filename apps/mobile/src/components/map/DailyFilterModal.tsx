/**
 * Daily Filter Modal Component
 *
 * A comprehensive modal for daily restaurant filtering with:
 * - Price range slider ($10-$50)
 * - Diet preferences (All/Vegetarian/Vegan) with protein options
 * - Cuisine selection with grid layout
 * - Hunger level selection (diet/normal/starving)
 *
 * Note: Meat/fish/seafood options are disabled when vegetarian/vegan is selected
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { useFilterStore } from '../../stores/filterStore';
import { ViewModeToggle } from './ViewModeToggle';
import { modals } from '@/styles';

interface DailyFilterModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DailyFilterModal: React.FC<DailyFilterModalProps> = ({ visible, onClose }) => {
  const {
    daily,
    setDailyPriceRange,
    toggleDailyCuisine,
    toggleDailyMeal,
    setDietPreference,
    toggleProteinType,
    setSpiceLevel,
    setHungerLevel,
  } = useFilterStore();

  const [mealModalVisible, setMealModalVisible] = React.useState(false);

  // Helper function to check if protein options should be disabled
  const isProteinDisabled = (proteinKey: string) => {
    if (daily.dietPreference === 'vegan') {
      return (
        proteinKey === 'meat' ||
        proteinKey === 'fish' ||
        proteinKey === 'seafood' ||
        proteinKey === 'egg'
      );
    }
    if (daily.dietPreference === 'vegetarian') {
      return proteinKey === 'meat' || proteinKey === 'fish' || proteinKey === 'seafood';
    }
    return false;
  };

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
            <Text style={[modals.title, modals.darkTitle]}>🎯 Daily Filters</Text>
            <TouchableOpacity
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: '#FF9800',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={onClose}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: '#FFFFFF',
                  fontWeight: '600',
                }}
              >
                Apply
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
          >
            {/* 1. Price Range Section - Dual Slider */}
            <View style={[modals.section, { marginTop: -20 }]}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>
                💰 How much would you like to spend?
              </Text>
              <View style={modals.priceSliderContainer}>
                <View style={modals.priceSliderLabels}>
                  <Text style={[modals.priceSliderLabel, modals.darkPriceLabel]}>
                    ${daily.priceRange.min}
                  </Text>
                  <Text style={[modals.priceSliderLabel, modals.darkPriceLabel]}>
                    ${daily.priceRange.max}
                  </Text>
                </View>
                <DualRangeSlider
                  min={10}
                  max={50}
                  valueMin={daily.priceRange.min}
                  valueMax={daily.priceRange.max}
                  onValuesChange={(min, max) => setDailyPriceRange(min, max)}
                />
              </View>
            </View>

            {/* 2. Diet Preference Section */}
            <View style={modals.section}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>
                🥗 Meat, fish, veggies?
              </Text>

              {/* Diet Type Tabs */}
              <View style={modals.tabContainer}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'vegetarian', label: 'Vegetarian' },
                  { key: 'vegan', label: 'Vegan' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[modals.tab, daily.dietPreference === option.key && modals.selectedTab]}
                    onPress={() => setDietPreference(option.key as any)}
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
              </View>

              {/* Protein Options */}
              <View style={modals.multiOptionContainer}>
                <View style={modals.optionsRow}>
                  {[
                    { key: 'meat', label: '🥩 Meat' },
                    { key: 'fish', label: '🐟 Fish' },
                    { key: 'seafood', label: '🦐 Seafood' },
                    { key: 'egg', label: '🥚 Egg' },
                  ].map(protein => {
                    const disabled = isProteinDisabled(protein.key);
                    return (
                      <TouchableOpacity
                        key={protein.key}
                        style={[
                          modals.option,
                          daily.proteinTypes[protein.key as keyof typeof daily.proteinTypes] &&
                            !disabled &&
                            modals.selectedOption,
                          disabled && { opacity: 0.4 },
                        ]}
                        onPress={() => {
                          if (!disabled) {
                            toggleProteinType(protein.key as any);
                          }
                        }}
                        disabled={disabled}
                      >
                        <Text
                          style={[
                            modals.optionText,
                            modals.darkOptionText,
                            daily.proteinTypes[protein.key as keyof typeof daily.proteinTypes] &&
                              !disabled &&
                              modals.selectedText,
                            disabled && modals.disabledOptionText,
                          ]}
                        >
                          {protein.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 3. Cuisine Section */}
            <View style={modals.section}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>🍽️ Cuisine</Text>
              <View style={modals.cuisineGrid}>
                {[
                  'Italian',
                  'Asian',
                  'Mexican',
                  'American',
                  'Indian',
                  'Mediterranean',
                  'French',
                ].map(cuisine => (
                  <TouchableOpacity
                    key={cuisine}
                    style={[
                      modals.cuisineOption,
                      daily.cuisineTypes.includes(cuisine) && modals.selectedOption,
                    ]}
                    onPress={() => toggleDailyCuisine(cuisine)}
                  >
                    <Text
                      style={[
                        modals.cuisineText,
                        modals.darkCuisineText,
                        daily.cuisineTypes.includes(cuisine) && modals.selectedText,
                      ]}
                    >
                      {cuisine}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={modals.cuisineOption}
                  onPress={() => {
                    // TODO: Open wider cuisine selection modal
                    Alert.alert('More Cuisines', 'Feature coming soon!');
                  }}
                >
                  <Text style={[modals.cuisineText, modals.darkCuisineText]}>Other</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3.5. Meal Section */}
            <View style={modals.section}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>🍔 Meal</Text>
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
                      daily.meals.includes(meal) && modals.selectedOption,
                    ]}
                    onPress={() => toggleDailyMeal(meal)}
                  >
                    <Text
                      style={[
                        modals.cuisineText,
                        modals.darkCuisineText,
                        daily.meals.includes(meal) && modals.selectedText,
                      ]}
                    >
                      {meal}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={modals.cuisineOption}
                  onPress={() => setMealModalVisible(true)}
                >
                  <Text style={[modals.cuisineText, modals.darkCuisineText]}>Other</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. Spice Level Section - TEMPORARILY HIDDEN */}
            {/* <View style={modals.section}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>🌶️ Spicy?</Text>
              <View style={modals.tabContainer}>
                {[
                  { key: 'noSpicy', label: 'No spicy' },
                  { key: 'eitherWay', label: 'Either way' },
                  { key: 'iLikeSpicy', label: 'Spicy' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[modals.tab, daily.spiceLevel === option.key && modals.selectedTab]}
                    onPress={() => setSpiceLevel(option.key as any)}
                  >
                    <Text
                      style={[
                        modals.tabText,
                        modals.darkTabText,
                        daily.spiceLevel === option.key && modals.selectedTabText,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View> */}

            {/* 5. Hunger Level Section - TEMPORARILY HIDDEN */}
            {/* <View style={modals.section}>
              <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>😋 Hungry, huh?</Text>
              <View style={modals.tabContainer}>
                {[
                  { key: 'diet', label: 'On a diet' },
                  { key: 'normal', label: 'Normal' },
                  { key: 'starving', label: 'Starving' },
                ].map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[modals.tab, daily.hungerLevel === option.key && modals.selectedTab]}
                    onPress={() => setHungerLevel(option.key as any)}
                  >
                    <Text
                      style={[
                        modals.tabText,
                        modals.darkTabText,
                        daily.hungerLevel === option.key && modals.selectedTabText,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View> */}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Meal Selection Modal */}
      <MealSelectionModal
        visible={mealModalVisible}
        onClose={() => setMealModalVisible(false)}
        selectedMeals={daily.meals}
        onToggleMeal={toggleDailyMeal}
      />
    </Modal>
  );
};

/**
 * Meal Selection Modal Component
 *
 * A modal for selecting additional meal/dish types beyond the popular options
 */
interface MealSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMeals: string[];
  onToggleMeal: (meal: string) => void;
}

// Extended list of dishes/meals
const ALL_MEALS = [
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

const MealSelectionModal: React.FC<MealSelectionModalProps> = ({
  visible,
  onClose,
  selectedMeals,
  onToggleMeal,
}) => {
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={modals.overlay}>
        <View style={[modals.container, modals.darkContainer, { maxHeight: '80%' }]}>
          <View style={modals.header}>
            <Text style={[modals.title, modals.darkTitle]}>🍔 Select Meals</Text>
            <TouchableOpacity
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: '#FF9800',
              }}
              onPress={onClose}
            >
              <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>Done</Text>
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
                    {meal}
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
}

const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min,
  max,
  valueMin,
  valueMax,
  onValuesChange,
}) => {
  const [activeThumb, setActiveThumb] = React.useState<'min' | 'max' | null>(null);
  const sliderWidth = 300;

  const handlePress = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
    const newValue = Math.round(min + percentage * (max - min));

    // Determine which thumb to move based on proximity
    const distToMin = Math.abs(newValue - valueMin);
    const distToMax = Math.abs(newValue - valueMax);

    if (distToMin < distToMax) {
      // Move min thumb, but don't exceed max
      const clampedMin = Math.min(newValue, valueMax - 1);
      onValuesChange(clampedMin, valueMax);
    } else {
      // Move max thumb, but don't go below min
      const clampedMax = Math.max(newValue, valueMin + 1);
      onValuesChange(valueMin, clampedMax);
    }
  };

  const minPosition = ((valueMin - min) / (max - min)) * 100;
  const maxPosition = ((valueMax - min) / (max - min)) * 100;

  return (
    <TouchableOpacity style={modals.priceSliderTrack} onPress={handlePress} activeOpacity={1}>
      {/* Active range highlight */}
      <View
        style={[
          modals.priceSliderActiveRange,
          {
            left: `${minPosition}%`,
            width: `${maxPosition - minPosition}%`,
          },
        ]}
      />
      {/* Min thumb */}
      <View style={[modals.priceSliderThumb, { left: `${minPosition}%` }]} />
      {/* Max thumb */}
      <View style={[modals.priceSliderThumb, { left: `${maxPosition}%` }]} />
    </TouchableOpacity>
  );
};
