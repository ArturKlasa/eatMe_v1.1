import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFilterStore } from '../stores/filterStore';

interface DrawerFiltersProps {
  onClose?: () => void;
}

export const DrawerFilters: React.FC<DrawerFiltersProps> = ({ onClose }) => {
  const {
    permanent,
    toggleAllergy,
    toggleReligiousCultural,
    setStrictDietType,
    toggleAccessibility,
    resetPermanentFilters,
  } = useFilterStore();

  const allergyOptions: Array<keyof typeof permanent.allergies> = [
    'nuts',
    'dairy',
    'gluten',
    'shellfish',
    'eggs',
    'soy',
  ];

  const religiousOptions: Array<keyof typeof permanent.religiousCultural> = [
    'halal',
    'kosher',
    'jain',
    'buddhist',
  ];

  const dietTypeOptions: Array<typeof permanent.strictDietType> = [
    'none',
    'vegetarian',
    'vegan',
    'pescatarian',
  ];

  const accessibilityOptions: Array<keyof typeof permanent.accessibility> = [
    'wheelchairAccessible',
    'hearingImpaired',
    'visuallyImpaired',
  ];

  const formatLabel = (key: string): string => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Permanent Filters</Text>
        <TouchableOpacity onPress={resetPermanentFilters} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Reset All</Text>
        </TouchableOpacity>
      </View>

      {/* Allergies Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚫 Allergies (Hard Constraints)</Text>
        <View style={styles.optionsContainer}>
          {allergyOptions.map(allergy => (
            <TouchableOpacity
              key={allergy}
              style={[styles.allergyOption, permanent.allergies[allergy] && styles.selectedOption]}
              onPress={() => toggleAllergy(allergy)}
            >
              <Text
                style={[styles.optionText, permanent.allergies[allergy] && styles.selectedText]}
              >
                {formatLabel(allergy)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Religious/Cultural Requirements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🕌 Religious/Cultural Requirements</Text>
        <View style={styles.optionsContainer}>
          {religiousOptions.map(requirement => (
            <TouchableOpacity
              key={requirement}
              style={[
                styles.religiousOption,
                permanent.religiousCultural[requirement] && styles.selectedOption,
              ]}
              onPress={() => toggleReligiousCultural(requirement)}
            >
              <Text
                style={[
                  styles.optionText,
                  permanent.religiousCultural[requirement] && styles.selectedText,
                ]}
              >
                {formatLabel(requirement)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Strict Diet Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🥗 Strict Diet Type</Text>
        <View style={styles.optionsContainer}>
          {dietTypeOptions.map(dietType => (
            <TouchableOpacity
              key={dietType}
              style={[
                styles.dietTypeOption,
                permanent.strictDietType === dietType && styles.selectedOption,
              ]}
              onPress={() => setStrictDietType(dietType)}
            >
              <Text
                style={[
                  styles.optionText,
                  permanent.strictDietType === dietType && styles.selectedText,
                ]}
              >
                {dietType === 'none' ? 'No Restrictions' : formatLabel(dietType)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Accessibility Requirements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>♿ Accessibility Requirements</Text>
        <View style={styles.optionsContainer}>
          {accessibilityOptions.map(requirement => (
            <TouchableOpacity
              key={requirement}
              style={[
                styles.accessibilityOption,
                permanent.accessibility[requirement] && styles.selectedOption,
              ]}
              onPress={() => toggleAccessibility(requirement)}
            >
              <Text
                style={[
                  styles.optionText,
                  permanent.accessibility[requirement] && styles.selectedText,
                ]}
              >
                {formatLabel(requirement)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  priceOption: {
    margin: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 50,
    alignItems: 'center',
  },
  cuisineOption: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  allergyOption: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  religiousOption: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dietTypeOption: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  accessibilityOption: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  spiceOption: {
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
});
