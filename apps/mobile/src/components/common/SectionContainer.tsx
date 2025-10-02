import React from 'react';
import { View, Text } from 'react-native';
import { commonStyles } from '@/styles';

interface SectionContainerProps {
  title?: string;
  children: React.ReactNode;
  customStyles?: {
    container?: any;
    title?: any;
  };
}

/**
 * Reusable Section Container Component
 *
 * Provides consistent section styling with optional title
 * Used throughout screens for content organization
 */
export const SectionContainer: React.FC<SectionContainerProps> = ({
  title,
  children,
  customStyles = {},
}) => {
  return (
    <View style={[commonStyles.containers.section, customStyles.container]}>
      {title && <Text style={[commonStyles.text.h3, customStyles.title]}>{title}</Text>}
      {children}
    </View>
  );
};
