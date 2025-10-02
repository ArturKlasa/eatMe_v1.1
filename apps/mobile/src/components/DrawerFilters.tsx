/**
 * Permanent Filters Component - DrawerFilters
 *
 * Comprehensive permanent filtering interface with 7 main sections:
 * 1. Diet Preference: All/Vegetarian/Vegan (single selection)
 * 2. Exclude: No meat, No fish, No seafood, No eggs, No dairy (multiple selection)
 * 3. Allergies: Lactose, Gluten, Peanuts, Soy, Sesame, Shellfish, Nuts (multiple selection)
 * 4. Diet Preferences: Diabetic, Keto, Paleo, Low-carb, Pescatarian (multiple selection)
 * 5. Religious Restrictions: Halal, Hindu, Kosher (multiple selection)
 * 6. Restaurant Facilities: Family-friendly, Wheelchair-accessible, Pet-friendly, LGBT-accessible, Kid's menu (multiple selection)
 * 7. Ingredients to Avoid: Expandable list with 20 mock ingredients (multiple selection)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useFilterStore } from '../stores/filterStore';

interface DrawerFiltersProps {
  onClose?: () => void;
}

// Mock ingredients list (20 items)
const MOCK_INGREDIENTS = [
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

export const DrawerFilters: React.FC<DrawerFiltersProps> = ({ onClose }) => {
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Permanent Filters</Text>
        <TouchableOpacity onPress={resetPermanentFilters} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Reset All</Text>
        </TouchableOpacity>
      </View>

      {/* 1. Diet Preference - Single Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🥗 Diet Preference</Text>
        <View style={styles.tabContainer}>
          {(['all', 'vegetarian', 'vegan'] as const).map(option => (
            <TouchableOpacity
              key={option}
              style={[styles.tab, permanent.dietPreference === option && styles.selectedTab]}
              onPress={() => setPermanentDietPreference(option)}
            >
              <Text
                style={[
                  styles.tabText,
                  permanent.dietPreference === option && styles.selectedTabText,
                ]}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 2. Exclude - Multiple Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚫 Exclude</Text>
        <View style={styles.optionsContainer}>
          {(Object.keys(permanent.exclude) as (keyof typeof permanent.exclude)[]).map(exclusion => (
            <TouchableOpacity
              key={exclusion}
              style={[styles.option, permanent.exclude[exclusion] && styles.selectedOption]}
              onPress={() => toggleExclude(exclusion)}
            >
              <Text
                style={[styles.optionText, permanent.exclude[exclusion] && styles.selectedText]}
              >
                {formatCamelCase(exclusion)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 3. Allergies - Multiple Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠️ Allergies</Text>
        <View style={styles.optionsContainer}>
          {(Object.keys(permanent.allergies) as (keyof typeof permanent.allergies)[]).map(
            allergy => (
              <TouchableOpacity
                key={allergy}
                style={[styles.option, permanent.allergies[allergy] && styles.selectedOption]}
                onPress={() => toggleAllergy(allergy)}
              >
                <Text
                  style={[styles.optionText, permanent.allergies[allergy] && styles.selectedText]}
                >
                  {formatLabel(allergy)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* 4. Diet Preferences - Multiple Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🍃 Diet Preferences</Text>
        <View style={styles.optionsContainer}>
          {(Object.keys(permanent.dietTypes) as (keyof typeof permanent.dietTypes)[]).map(
            dietType => (
              <TouchableOpacity
                key={dietType}
                style={[styles.option, permanent.dietTypes[dietType] && styles.selectedOption]}
                onPress={() => toggleDietType(dietType)}
              >
                <Text
                  style={[styles.optionText, permanent.dietTypes[dietType] && styles.selectedText]}
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

      {/* 5. Religious Restrictions - Multiple Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🕌 Religious Restrictions</Text>
        <View style={styles.optionsContainer}>
          {(
            Object.keys(
              permanent.religiousRestrictions
            ) as (keyof typeof permanent.religiousRestrictions)[]
          ).map(restriction => (
            <TouchableOpacity
              key={restriction}
              style={[
                styles.option,
                permanent.religiousRestrictions[restriction] && styles.selectedOption,
              ]}
              onPress={() => toggleReligiousRestriction(restriction)}
            >
              <Text
                style={[
                  styles.optionText,
                  permanent.religiousRestrictions[restriction] && styles.selectedText,
                ]}
              >
                {formatLabel(restriction)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 6. Restaurant Facilities - Multiple Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏪 Restaurant Facilities</Text>
        <View style={styles.optionsContainer}>
          {(Object.keys(permanent.facilities) as (keyof typeof permanent.facilities)[]).map(
            facility => (
              <TouchableOpacity
                key={facility}
                style={[styles.option, permanent.facilities[facility] && styles.selectedOption]}
                onPress={() => toggleFacility(facility)}
              >
                <Text
                  style={[styles.optionText, permanent.facilities[facility] && styles.selectedText]}
                >
                  {formatCamelCase(facility)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* 7. Ingredients to Avoid - Expandable List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🥄 Ingredients You Would Like to Avoid</Text>
        <TouchableOpacity
          style={styles.expandableButton}
          onPress={() => setShowIngredientsModal(true)}
        >
          <Text style={styles.expandableButtonText}>
            Select Ingredients ({permanent.ingredientsToAvoid.length} selected)
          </Text>
          <Text style={styles.expandableArrow}>→</Text>
        </TouchableOpacity>

        {permanent.ingredientsToAvoid.length > 0 && (
          <View style={styles.selectedIngredientsContainer}>
            <Text style={styles.selectedIngredientsTitle}>Selected:</Text>
            <View style={styles.selectedIngredientsRow}>
              {permanent.ingredientsToAvoid.map(ingredient => (
                <View key={ingredient} style={styles.selectedIngredientTag}>
                  <Text style={styles.selectedIngredientText}>{ingredient}</Text>
                  <TouchableOpacity
                    onPress={() => removeIngredientToAvoid(ingredient)}
                    style={styles.removeIngredientButton}
                  >
                    <Text style={styles.removeIngredientText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Ingredients Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showIngredientsModal}
        onRequestClose={() => setShowIngredientsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Ingredients to Avoid</Text>
              <TouchableOpacity
                onPress={() => setShowIngredientsModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={true}>
                <View style={styles.ingredientsList}>
                  {MOCK_INGREDIENTS.map(ingredient => (
                    <TouchableOpacity
                      key={ingredient}
                      style={styles.ingredientListItem}
                      onPress={() => handleIngredientToggle(ingredient)}
                    >
                      <View style={styles.ingredientListContent}>
                        <Text style={styles.ingredientListText}>{ingredient}</Text>
                        <View
                          style={[
                            styles.ingredientCheckbox,
                            permanent.ingredientsToAvoid.includes(ingredient) &&
                              styles.ingredientCheckboxSelected,
                          ]}
                        >
                          {permanent.ingredientsToAvoid.includes(ingredient) && (
                            <Text style={styles.ingredientCheckboxCheck}>✓</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalDoneButton}
                onPress={() => setShowIngredientsModal(false)}
              >
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ff4444',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },

  // Tab container (for single selection like diet preference)
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  selectedTab: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  selectedTabText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Options container (for multiple selection)
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  option: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedOption: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  selectedText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Expandable button for ingredients
  expandableButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  expandableButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  expandableArrow: {
    fontSize: 16,
    color: '#666',
  },

  // Selected ingredients display
  selectedIngredientsContainer: {
    marginTop: 12,
  },
  selectedIngredientsTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  selectedIngredientsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  selectedIngredientTag: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 4,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
  },
  selectedIngredientText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  removeIngredientButton: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  removeIngredientText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#666',
  },
  modalContent: {
    height: 400,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#f9f9f9',
  },
  ingredientsList: {
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  ingredientListItem: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    minHeight: 50,
  },
  ingredientListContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  ingredientListText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  ingredientCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingredientCheckboxSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  ingredientCheckboxCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  ingredientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  ingredientOption: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalDoneButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
