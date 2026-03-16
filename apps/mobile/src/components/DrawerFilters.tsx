/**
 * Permanent Filters Component - DrawerFilters
 *
 * Comprehensive permanent filtering interface with 7 main sections:
 * 1. Diet Preference: All/Vegetarian/Vegan (single selection)
 * 2. Exclude: No meat, No fish, No seafood, No eggs, No dairy (multiple selection)
 * 3. Allergies: Lactose, Gluten, Peanuts, Soy, Sesame, Shellfish, Nuts (multiple selection)
 * 4. Ingredients to Avoid: Search-as-you-type picker backed by ingredient_aliases
 * 5. Diet Preferences: Diabetic, Keto, Paleo, Low-carb, Pescatarian (multiple selection)
 * 6. Religious Restrictions: Halal, Hindu, Kosher (multiple selection)
 * 7. Restaurant Facilities: Family-friendly, Wheelchair-accessible, Pet-friendly, LGBT-accessible, Kid's menu (multiple selection)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFilterStore } from '../stores/filterStore';
import type { IngredientToAvoid } from '../stores/filterStore';
import { drawerFiltersStyles } from '@/styles';
import {
  fetchCommonIngredients,
  searchIngredientAliases,
  type IngredientSuggestion,
} from '../services/ingredientService';

interface DrawerFiltersProps {
  onClose?: () => void;
  onScroll?: (event: any) => void;
}

export const DrawerFilters: React.FC<DrawerFiltersProps> = ({ onClose, onScroll }) => {
  const { t } = useTranslation();
  // ── Ingredient picker state ──────────────────────────────────────────────
  const [showIngredientsModal, setShowIngredientsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [commonIngredients, setCommonIngredients] = useState<IngredientSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fetch common ingredients once so they are ready when the modal opens.
  useEffect(() => {
    fetchCommonIngredients().then(setCommonIngredients);
  }, []);

  // Debounced search: fires 300 ms after the user stops typing.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchIngredientAliases(searchQuery);
      setSuggestions(results);
      setIsSearching(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const handleOpenModal = useCallback(() => {
    setSearchQuery('');
    setSuggestions([]);
    setShowIngredientsModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSearchQuery('');
    setSuggestions([]);
    setShowIngredientsModal(false);
  }, []);

  // ── Store ────────────────────────────────────────────────────────────────

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

  // ── Ingredient toggle helper ─────────────────────────────────────────────
  const isAvoided = (canonicalIngredientId: string) =>
    permanent.ingredientsToAvoid.some(i => i.canonicalIngredientId === canonicalIngredientId);

  const handleIngredientToggle = (item: IngredientSuggestion) => {
    if (isAvoided(item.canonicalIngredientId)) {
      removeIngredientToAvoid(item.canonicalIngredientId);
    } else {
      addIngredientToAvoid({
        canonicalIngredientId: item.canonicalIngredientId,
        displayName: item.displayName,
      } satisfies IngredientToAvoid);
    }
  };

  // List shown inside the modal: search results if the user has typed ≥2 chars,
  // otherwise the common-ingredients list.
  const displayList = searchQuery.trim().length >= 2 ? suggestions : commonIngredients;

  const formatLabel = (key: string): string =>
    key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

  const formatCamelCase = (key: string): string =>
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/^./, str => str.toUpperCase());

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
        <Text style={drawerFiltersStyles.title}>{t('filters.personalPreferences')}</Text>
        <TouchableOpacity onPress={onClose} style={drawerFiltersStyles.clearButton}>
          <Text style={drawerFiltersStyles.clearButtonText}>{t('common.apply')}</Text>
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
        <Text style={drawerFiltersStyles.sectionTitle}>{t('filters.excludeTitle')}</Text>
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
                  {t(`filters.exclude.${exclusion}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Allergies - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>{t('filters.allergiesTitle')}</Text>
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
                  {t(`filters.allergy.${allergy}`)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* 4. Ingredients to Avoid - Expandable List */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>{t('filters.ingredientsToAvoidTitle')}</Text>
        <TouchableOpacity style={drawerFiltersStyles.expandableButton} onPress={handleOpenModal}>
          <Text style={drawerFiltersStyles.expandableButtonText}>
            {t('filters.selectIngredients', { count: permanent.ingredientsToAvoid.length })}
          </Text>
          <Text style={drawerFiltersStyles.expandableArrow}>→</Text>
        </TouchableOpacity>

        {permanent.ingredientsToAvoid.length > 0 && (
          <View style={drawerFiltersStyles.selectedIngredientsContainer}>
            <Text style={drawerFiltersStyles.selectedIngredientsTitle}>
              {t('common.selected')}:
            </Text>
            <View style={drawerFiltersStyles.selectedIngredientsRow}>
              {permanent.ingredientsToAvoid.map(item => (
                <View
                  key={item.canonicalIngredientId}
                  style={drawerFiltersStyles.selectedIngredientTag}
                >
                  <Text style={drawerFiltersStyles.selectedIngredientText}>{item.displayName}</Text>
                  <TouchableOpacity
                    onPress={() => removeIngredientToAvoid(item.canonicalIngredientId)}
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
        <Text style={drawerFiltersStyles.sectionTitle}>{t('filters.dietPreferencesTitle')}</Text>
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
                  {t(`filters.dietType.${dietType}`)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      {/* 6. Religious Restrictions - Multiple Selection */}
      <View style={drawerFiltersStyles.section}>
        <Text style={drawerFiltersStyles.sectionTitle}>
          {t('filters.religiousRestrictionsTitle')}
        </Text>
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
                {t(`filters.religious.${restriction}`)}
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
        onRequestClose={handleCloseModal}
      >
        <View style={drawerFiltersStyles.modalOverlay}>
          <View style={drawerFiltersStyles.modalContainer}>
            <View style={drawerFiltersStyles.modalHeader}>
              <Text style={drawerFiltersStyles.modalTitle}>{t('filters.ingredientsToAvoid')}</Text>
              <TouchableOpacity
                onPress={handleCloseModal}
                style={drawerFiltersStyles.modalCloseButton}
              >
                <Text style={drawerFiltersStyles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={drawerFiltersStyles.ingredientSearchContainer}>
              <TextInput
                style={drawerFiltersStyles.ingredientSearchInput}
                placeholder={t('filters.searchIngredients')}
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {isSearching && (
                <ActivityIndicator
                  size="small"
                  style={drawerFiltersStyles.ingredientSearchSpinner}
                />
              )}
            </View>

            {/* Section header */}
            {searchQuery.trim().length < 2 && commonIngredients.length > 0 && (
              <Text style={drawerFiltersStyles.ingredientSectionHeader}>
                {t('filters.commonlyAvoided')}
              </Text>
            )}
            {searchQuery.trim().length >= 2 && !isSearching && suggestions.length === 0 && (
              <Text style={drawerFiltersStyles.ingredientSectionHeader}>
                {t('filters.noResults', { query: searchQuery })}
              </Text>
            )}

            <View style={drawerFiltersStyles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={true}>
                <View style={drawerFiltersStyles.ingredientsList}>
                  {displayList.map(item => {
                    const selected = isAvoided(item.canonicalIngredientId);
                    return (
                      <TouchableOpacity
                        key={item.aliasId}
                        style={drawerFiltersStyles.ingredientListItem}
                        onPress={() => handleIngredientToggle(item)}
                      >
                        <View style={drawerFiltersStyles.ingredientListContent}>
                          <Text style={drawerFiltersStyles.ingredientListText}>
                            {item.displayName}
                          </Text>
                          <View
                            style={[
                              drawerFiltersStyles.ingredientCheckbox,
                              selected && drawerFiltersStyles.ingredientCheckboxSelected,
                            ]}
                          >
                            {selected && (
                              <Text style={drawerFiltersStyles.ingredientCheckboxCheck}>✓</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View style={drawerFiltersStyles.modalFooter}>
              <TouchableOpacity
                style={drawerFiltersStyles.modalDoneButton}
                onPress={handleCloseModal}
              >
                <Text style={drawerFiltersStyles.modalDoneText}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
