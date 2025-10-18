/**
 * Map Header Component
 *
 * Header bar for map screen with navigation menu and location controls
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonStyles } from '@/styles';

interface MapHeaderProps {
  onMenuPress: () => void;
  onFilterPress: () => void;
}

export const MapHeader: React.FC<MapHeaderProps> = ({ onMenuPress, onFilterPress }) => {
  return (
    <View style={[commonStyles.mapStyles.header, { paddingTop: 35, paddingBottom: 10 }]}>
      <View style={commonStyles.mapStyles.headerContent}>
        <TouchableOpacity style={commonStyles.buttons.iconButton} onPress={onMenuPress}>
          <Text>☰</Text>
        </TouchableOpacity>

        <View style={commonStyles.mapStyles.headerText}>
          {/* No title or subtitle - clean header */}
        </View>

        <TouchableOpacity
          style={[commonStyles.buttons.iconButton, { minWidth: 80, paddingHorizontal: 12 }]}
          onPress={onFilterPress}
        >
          <Text>🥢 Filter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
