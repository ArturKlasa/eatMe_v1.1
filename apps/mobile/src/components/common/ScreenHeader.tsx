import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonStyles } from '@/styles';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBackPress: () => void;
  backButtonText?: string;
  rightComponent?: React.ReactNode;
}

/**
 * Reusable Screen Header Component
 *
 * Provides consistent header across all screens with:
 * - Back navigation
 * - Title and optional subtitle
 * - Optional right-side component
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBackPress,
  backButtonText = '←',
  rightComponent,
}) => {
  return (
    <View style={commonStyles.headers.container}>
      <View style={commonStyles.mapStyles.headerContent}>
        <TouchableOpacity style={commonStyles.buttons.iconButton} onPress={onBackPress}>
          <Text>{backButtonText}</Text>
        </TouchableOpacity>
        <View style={commonStyles.mapStyles.headerText}>
          <Text style={commonStyles.headers.title}>{title}</Text>
          {subtitle && <Text style={commonStyles.headers.subtitle}>{subtitle}</Text>}
        </View>
        <View style={commonStyles.buttons.iconButton}>{rightComponent}</View>
      </View>
    </View>
  );
};
