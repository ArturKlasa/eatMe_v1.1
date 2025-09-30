import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import type { FavoritesScreenProps } from '@/types/navigation';

/**
 * FavoritesScreen Component
 *
 * Placeholder screen for favorite restaurants and dishes.
 * Will be enhanced with swipe preferences integration in later tasks.
 */
export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Favorites</Text>
        <Text style={styles.subText}>Your Liked Restaurants & Dishes</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>❤️</Text>
          <Text style={styles.emptyTitle}>No Favorites Yet</Text>
          <Text style={styles.emptyDescription}>
            Start swiping on dishes and liking restaurants to build your personal collection!
          </Text>
        </View>

        <View style={styles.futureFeatures}>
          <Text style={styles.featuresTitle}>Coming Soon:</Text>
          <Text style={styles.featureItem}>• Favorite restaurants list</Text>
          <Text style={styles.featureItem}>• Liked dishes collection</Text>
          <Text style={styles.featureItem}>• Personal taste preferences</Text>
          <Text style={styles.featureItem}>• Quick access from map</Text>
          <Text style={styles.featureItem}>• Share favorites with friends</Text>
        </View>
      </ScrollView>
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
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  futureFeatures: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  featureItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    paddingLeft: 10,
  },
});

export default FavoritesScreen;
