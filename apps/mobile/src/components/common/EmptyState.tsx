import React from 'react';
import { View, Text } from 'react-native';
import { commonStyles } from '@/styles';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  customStyles?: {
    container?: any;
    icon?: any;
    title?: any;
    description?: any;
  };
}

/**
 * Reusable Empty State Component
 *
 * Displays when screens have no content to show
 * with consistent styling and messaging pattern
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  customStyles = {},
}) => {
  return (
    <View style={[commonStyles.emptyState.container, customStyles.container]}>
      <Text style={[commonStyles.emptyState.icon, customStyles.icon]}>{icon}</Text>
      <Text style={[commonStyles.emptyState.title, customStyles.title]}>{title}</Text>
      <Text style={[commonStyles.emptyState.description, customStyles.description]}>
        {description}
      </Text>
    </View>
  );
};
