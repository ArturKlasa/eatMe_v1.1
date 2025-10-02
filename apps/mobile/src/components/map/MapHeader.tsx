/**
 * Map Header Component
 * 
 * Header bar for map screen with navigation menu, title, and location controls
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonStyles } from '@/styles';

interface MapHeaderProps {
  onMenuPress: () => void;
  onLocationPress: () => void;
  locationLoading: boolean;
}

export const MapHeader: React.FC<MapHeaderProps> = ({
  onMenuPress,
  onLocationPress,
  locationLoading,
}) => {
  return (
    <View style={commonStyles.mapStyles.header}>
      <View style={commonStyles.mapStyles.headerContent}>
        <TouchableOpacity style={commonStyles.buttons.iconButton} onPress={onMenuPress}>
          <Text>☰</Text>
        </TouchableOpacity>
        
        <View style={commonStyles.mapStyles.headerText}>
          <Text style={commonStyles.mapStyles.title}>Food Map</Text>
          <Text style={commonStyles.mapStyles.subtitle}>Discover nearby restaurants</Text>
        </View>
        
        <TouchableOpacity
          style={commonStyles.buttons.iconButton}
          onPress={onLocationPress}
          disabled={locationLoading}
        >
          <Text>{locationLoading ? '🎯...' : '🎯'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};