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

  const handleClearFilters = () => {
    // Reset filters to default values
    setDailyPriceRange(1, 4);
    setHungerLevel('normal');
    setDietPreference('all');
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={modals.overlay}>
        <View style={[modals.container, { backgroundColor: '#1A1A1A' }]}>
          <View style={modals.header}>
            <Text style={[modals.title, { color: '#E0E0E0' }]}>🎯 Daily Filters</Text>
          </View>

          {/* View Mode Toggle */}
          <ViewModeToggle style={{ marginVertical: 16 }} />

          <ScrollView style={modals.content} showsVerticalScrollIndicator={false} bounces={false}>
            {/* 1. Price Range Section - Slider */}
            <View style={modals.section}>
              <Text style={[modals.sectionTitle, { color: '#E0E0E0' }]}>
                💰 How much would you like to spend?
              </Text>
              <View style={modals.priceSliderContainer}>
                <View style={modals.priceSliderLabels}>
                  <Text style={[modals.priceSliderLabel, { color: '#CCCCCC' }]}>
                    ${daily.priceRange.min}
                  </Text>
                  <Text style={[modals.priceSliderLabel, { color: '#CCCCCC' }]}>
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
              <Text style={[modals.sectionTitle, { color: '#E0E0E0' }]}>
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
                        { color: '#E0E0E0' },
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
                            { color: '#E0E0E0' },
                            daily.proteinTypes[protein.key as keyof typeof daily.proteinTypes] &&
                              !disabled &&
                              modals.selectedText,
                            disabled && { color: '#666' },
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
              <Text style={[modals.sectionTitle, { color: '#E0E0E0' }]}>🍽️ Cuisine</Text>
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
                        { color: '#E0E0E0' },
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
                  <Text style={[modals.cuisineText, { color: '#E0E0E0' }]}>Other</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. Hunger Level Section */}
            <View style={modals.section}>
              <Text style={[modals.sectionTitle, { color: '#E0E0E0' }]}>😋 Hungry, huh?</Text>
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
                        { color: '#E0E0E0' },
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

          <View style={modals.footer}>
            <TouchableOpacity style={modals.clearButton} onPress={handleClearFilters}>
              <Text style={[modals.clearText, { color: '#E0E0E0' }]}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modals.applyButton} onPress={onClose}>
              <Text style={[modals.applyText, { color: '#FFFFFF' }]}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
