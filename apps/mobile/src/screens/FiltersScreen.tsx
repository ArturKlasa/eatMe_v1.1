import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { commonStyles } from '@/styles';
import type { FiltersScreenProps } from '@/types/navigation';

/**
 * FiltersScreen Component
 *
 * Placeholder screen for search and dining filters.
 * Will be enhanced with advanced filtering options in later tasks.
 */
export const FiltersScreen: React.FC<FiltersScreenProps> = ({ navigation }) => {
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
            <Text style={commonStyles.headers.title}>Filters</Text>
            <Text style={commonStyles.headers.subtitle}>Customize Your Experience</Text>
          </View>
          <View style={commonStyles.buttons.iconButton} />
        </View>
      </View>

      <ScrollView style={commonStyles.containers.content}>
        <View style={commonStyles.emptyState.container}>
          <Text style={commonStyles.emptyState.icon}>🎯</Text>
          <Text style={commonStyles.emptyState.title}>Smart Filters Coming Soon</Text>
          <Text style={commonStyles.emptyState.description}>
            Personalize your food discovery with advanced filtering options!
          </Text>
        </View>

        <View style={[commonStyles.spacingUtils.paddingHorizontalBase, { paddingBottom: 40 }]}>
          <Text style={commonStyles.text.h3}>Planned Features:</Text>
          <Text style={commonStyles.text.featureItem}>• Distance & location radius</Text>
          <Text style={commonStyles.text.featureItem}>• Price range & budget</Text>
          <Text style={commonStyles.text.featureItem}>• Cuisine type & dietary restrictions</Text>
          <Text style={commonStyles.text.featureItem}>• Rating & review filters</Text>
          <Text style={commonStyles.text.featureItem}>• Operating hours & availability</Text>
          <Text style={commonStyles.text.featureItem}>• Special offers & promotions</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default FiltersScreen;
