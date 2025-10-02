import React from 'react';
import { View, Text } from 'react-native';
import { commonStyles } from '@/styles';
import { ScreenLayout, EmptyState, FeatureList } from '@/components/common';
import type { FavoritesScreenProps } from '@/types/navigation';

/**
 * FavoritesScreen Component
 *
 * Placeholder screen for favorite restaurants and dishes.
 * Will be enhanced with swipe preferences integration in later tasks.
 */
export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
  const handleBackPress = () => {
    navigation.navigate('Map');
  };

  const comingSoonFeatures = [
    'Favorite restaurants list',
    'Liked dishes collection',
    'Personal taste preferences',
    'Quick access from map',
    'Share favorites with friends',
  ];

  return (
    <ScreenLayout
      title="Favorites"
      subtitle="Your Saved Places"
      onBackPress={handleBackPress}
      backButtonText="Back"
    >
      <EmptyState
        icon="❤️"
        title="No Favorites Yet"
        description="Start swiping on dishes and liking restaurants to build your personal collection!"
      />

      <View style={[commonStyles.spacingUtils.paddingHorizontalBase, { paddingBottom: 40 }]}>
        <FeatureList title="Coming Soon:" features={comingSoonFeatures} />
      </View>
    </ScreenLayout>
  );
};

export default FavoritesScreen;
