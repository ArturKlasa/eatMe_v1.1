import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { commonStyles } from '@/styles';
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

  return (
    <View style={commonStyles.containers.screen}>
      <View style={commonStyles.headers.container}>
        <View style={commonStyles.mapStyles.headerContent}>
          <TouchableOpacity style={commonStyles.buttons.iconButton} onPress={handleBackPress}>
            <Text>Back</Text>
          </TouchableOpacity>
          <View style={commonStyles.mapStyles.headerText}>
            <Text style={commonStyles.headers.title}>Favorites</Text>
            <Text style={commonStyles.headers.subtitle}>Your Saved Places</Text>
          </View>
          <View style={commonStyles.buttons.iconButton} />
        </View>
      </View>

      <ScrollView style={commonStyles.containers.content}>
        <View style={commonStyles.emptyState.container}>
          <Text style={commonStyles.emptyState.icon}>❤️</Text>
          <Text style={commonStyles.emptyState.title}>No Favorites Yet</Text>
          <Text style={commonStyles.emptyState.description}>
            Start swiping on dishes and liking restaurants to build your personal collection!
          </Text>
        </View>

        <View style={[commonStyles.spacingUtils.paddingHorizontalBase, { paddingBottom: 40 }]}>
          <Text style={commonStyles.text.h3}>Coming Soon:</Text>
          <Text style={commonStyles.text.featureItem}>• Favorite restaurants list</Text>
          <Text style={commonStyles.text.featureItem}>• Liked dishes collection</Text>
          <Text style={commonStyles.text.featureItem}>• Personal taste preferences</Text>
          <Text style={commonStyles.text.featureItem}>• Quick access from map</Text>
          <Text style={commonStyles.text.featureItem}>• Share favorites with friends</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default FavoritesScreen;
