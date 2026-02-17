/**
 * Permanent Filters Component - DrawerFilters
 *
 * Comprehensive permanent filtering interface with 7 main sections:
 * 1. Diet Preference: All/Vegetarian/Vegan (single selection)
 * 2. Exclude: No meat, No fish, No seafood, No eggs, No dairy (multiple selection)
 * 3. Allergies: Lactose, Gluten, Peanuts, Soy, Sesame, Shellfish, Nuts (multiple selection)
 * 4. Ingredients to Avoid: Expandable list with 20 mock ingredients (multiple selection)
 * 5. Diet Preferences: Diabetic, Keto, Paleo, Low-carb, Pescatarian (multiple selection)
 * 6. Religious Restrictions: Halal, Hindu, Kosher (multiple selection)
 * 7. Restaurant Facilities: Family-friendly, Wheelchair-accessible, Pet-friendly, LGBT-accessible, Kid's menu (multiple selection)
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useFilterStore } from '../stores/filterStore';
import { drawerFiltersStyles } from '@/styles';

interface DrawerFiltersProps {
  onClose?: () => void;
  onScroll?: (event: any) => void;
}

// TODO: Replace with API call to fetch ingredients from Supabase ingredients_master table
// Common ingredients list for user preference filtering
const COMMON_INGREDIENTS = [
  'Cilantro',
  'Mushrooms',
  'Onions',
  'Garlic',
  'Ginger',
  'Tomatoes',
  'Bell Peppers',
  'Spinach',
  'Kale',
  'Broccoli',
  'Avocado',
  'Olives',
  'Coconut',
  'Raisins',
  'Pickles',
  'Spicy Food',
  'Mint',
  'Basil',
  'Oregano',
  'Paprika',
];

export const DrawerFilters: React.FC<DrawerFiltersProps> = ({ onClose, onScroll }) => {
  const {
    permanent,
    setPermanentDietPreference,
    toggleExclude,
    toggleAllergy,
    toggleDietType,
    toggleReligiousRestriction,
    toggleFacility,
    addIngredientToAvoid,
    removeIngredientToAvoid,
    resetPermanentFilters,
  } = useFilterStore();

  const [showIngredientsModal, setShowIngredientsModal] = useState(false);

  const formatLabel = (key: string): string => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const formatCamelCase = (key: string): string => {
    // Convert camelCase to readable format
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/^./, str => str.toUpperCase());
  };

  const handleIngredientToggle = (ingredient: string) => {
    if (permanent.ingredientsToAvoid.includes(ingredient)) {
      removeIngredientToAvoid(ingredient);
    } else {
      addIngredientToAvoid(ingredient);
    }
  };

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
        <Text style={drawerFiltersStyles.title}>Personal preference filters</Text>
        <TouchableOpacity onPress={onClose} style={drawerFiltersStyles.clearButton}>
          <Text style={drawerFiltersStyles.clearButtonText}>Apply</Text>
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
        <Text style={drawerFiltersStyles.sectionTitle}>🚫 Exclude</Text>
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
                  {formatCamelCase(exclusion)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Allergies - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>⚠️ Allergies</Text>
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
                  {formatLabel(allergy)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* 4. Ingredients to Avoid - Expandable List */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>🥄 Ingredients You Would Like to Avoid</Text>
        <TouchableOpacity
          style={drawerFiltersStyles.expandableButton}
          onPress={() => setShowIngredientsModal(true)}
        >
          <Text style={drawerFiltersStyles.expandableButtonText}>
            Select Ingredients ({permanent.ingredientsToAvoid.length} selected)
          </Text>
          <Text style={drawerFiltersStyles.expandableArrow}>→</Text>
        </TouchableOpacity>

        {permanent.ingredientsToAvoid.length > 0 && (
          <View style={drawerFiltersStyles.selectedIngredientsContainer}>
            <Text style={drawerFiltersStyles.selectedIngredientsTitle}>Selected:</Text>
            <View style={drawerFiltersStyles.selectedIngredientsRow}>
              {permanent.ingredientsToAvoid.map(ingredient => (
                <View key={ingredient} style={drawerFiltersStyles.selectedIngredientTag}>
                  <Text style={drawerFiltersStyles.selectedIngredientText}>{ingredient}</Text>
                  <TouchableOpacity
                    onPress={() => removeIngredientToAvoid(ingredient)}
                    style={drawerFiltersStyles.removeIngredientButton}
                  >
                    <Text style={drawerFiltersStyles.removeIngredientText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 5. Diet Preferences - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>🍃 Diet Preferences</Text>
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
                  {dietType === 'diabetic'
                    ? 'Suitable for Diabetics'
                    : dietType === 'keto'
                      ? 'Keto Diet'
                      : dietType === 'paleo'
                        ? 'Paleo Diet'
                        : dietType === 'lowCarb'
                          ? 'Low-carb Diet'
                          : 'Pescatarian'}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* 6. Religious Restrictions - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>🕌 Religious Restrictions</Text>
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
                {formatLabel(restriction)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 7. Restaurant Facilities - Multiple Selection */}
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

      {/* Ingredients Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showIngredientsModal}
        onRequestClose={() => setShowIngredientsModal(false)}
      >
        <View style={drawerFiltersStyles.modalOverlay}>
          <View style={drawerFiltersStyles.modalContainer}>
            <View style={drawerFiltersStyles.modalHeader}>
              <Text style={drawerFiltersStyles.modalTitle}>Select Ingredients to Avoid</Text>
              <TouchableOpacity
                onPress={() => setShowIngredientsModal(false)}
                style={drawerFiltersStyles.modalCloseButton}
              >
                <Text style={drawerFiltersStyles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={drawerFiltersStyles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={true}>
                <View style={drawerFiltersStyles.ingredientsList}>
                  {COMMON_INGREDIENTS.map(ingredient => (
                    <TouchableOpacity
                      key={ingredient}
                      style={drawerFiltersStyles.ingredientListItem}
                      onPress={() => handleIngredientToggle(ingredient)}
                    >
                      <View style={drawerFiltersStyles.ingredientListContent}>
                        <Text style={drawerFiltersStyles.ingredientListText}>{ingredient}</Text>
                        <View
                          style={[
                            drawerFiltersStyles.ingredientCheckbox,
                            permanent.ingredientsToAvoid.includes(ingredient) &&
                              drawerFiltersStyles.ingredientCheckboxSelected,
                          ]}
                        >
                          {permanent.ingredientsToAvoid.includes(ingredient) && (
                            <Text style={drawerFiltersStyles.ingredientCheckboxCheck}>✓</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={drawerFiltersStyles.modalFooter}>
              <TouchableOpacity
                style={drawerFiltersStyles.modalDoneButton}
                onPress={() => setShowIngredientsModal(false)}
              >
                <Text style={drawerFiltersStyles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
