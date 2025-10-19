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
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
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
    setDietPreference,
    toggleProteinType,
    setHungerLevel,
  } = useFilterStore();

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

          <ScrollView style={modals.content} showsVerticalScrollIndicator={false} bounces={false}>
            {/* 1. Price Range Section - Slider */}
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
                <TouchableOpacity
                  style={modals.priceSliderTrack}
                  onPress={e => {
                    // Simple click-to-set logic - can be enhanced with proper slider
                    const { locationX } = e.nativeEvent;
                    const width = 300; // approximate slider width
                    const percentage = locationX / width;
                    const newMax = Math.round(10 + percentage * 40); // $10-$50 range
                    setDailyPriceRange(10, Math.max(10, Math.min(50, newMax)));
                  }}
                >
                  <View
                    style={[
                      modals.priceSliderThumb,
                      { left: `${((daily.priceRange.max - 10) / 40) * 100}%` },
                    ]}
                  />
                </TouchableOpacity>
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

            {/* 4. Hunger Level Section */}
            <View style={modals.section}>
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
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
