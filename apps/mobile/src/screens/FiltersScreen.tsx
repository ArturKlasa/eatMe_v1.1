import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonStyles } from '@/styles';
import { useFilterStore } from '../stores/filterStore';
import { DrawerFilters } from '../components/DrawerFilters';
import type { FiltersScreenProps } from '@/types/navigation';

/**
 * FiltersScreen Component - Permanent Filters
 */
export const FiltersScreen: React.FC<FiltersScreenProps> = ({ navigation }) => {
  const { getPermanentFilterCount } = useFilterStore();

  const handleBackPress = () => {
    navigation.navigate('Map');
  };

  return (
    <View style={commonStyles.containers.screen}>
      <View style={commonStyles.headers.container}>
        <View style={commonStyles.mapStyles.headerContent}>
          <TouchableOpacity style={commonStyles.buttons.iconButton} onPress={handleBackPress}>
            <Text>←</Text>
          </TouchableOpacity>
          <View style={commonStyles.mapStyles.headerText}>
            <Text style={commonStyles.headers.title}>Permanent Filters</Text>
            <Text style={commonStyles.headers.subtitle}>
              {getPermanentFilterCount()} permanent filters active
            </Text>
          </View>
          <View style={commonStyles.buttons.iconButton} />
        </View>
      </View>

      <DrawerFilters onClose={() => navigation.navigate('Map')} />
    </View>
  );
};

export default FiltersScreen;
