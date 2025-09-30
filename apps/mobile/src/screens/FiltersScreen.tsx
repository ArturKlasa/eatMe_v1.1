import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import type { FiltersScreenProps } from '@/types/navigation';

/**
 * FiltersScreen Component
 *
 * Placeholder screen for filter functionality.
 * Will be enhanced in Task 1.4.1 with comprehensive filter UI components.
 */
export const FiltersScreen: React.FC<FiltersScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Filters</Text>
        <Text style={styles.subText}>Coming Soon</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.descriptionText}>🎛️ Filter controls will be implemented here:</Text>
        <Text style={styles.listItem}>• Price range slider ($ to $$$$)</Text>
        <Text style={styles.listItem}>• Cuisine type selection</Text>
        <Text style={styles.listItem}>• Dietary restrictions</Text>
        <Text style={styles.listItem}>• Distance radius</Text>
        <Text style={styles.listItem}>• Rating threshold</Text>
        <Text style={styles.listItem}>• Open now toggle</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  descriptionText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    fontWeight: '600',
  },
  listItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    paddingLeft: 10,
  },
});

export default FiltersScreen;
