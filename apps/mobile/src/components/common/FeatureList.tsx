import React from 'react';
import { View, Text } from 'react-native';
import { commonStyles } from '@/styles';

interface FeatureListProps {
  title: string;
  features: string[];
  customStyles?: {
    container?: any;
    title?: any;
    item?: any;
  };
}

/**
 * Reusable Feature List Component
 *
 * Displays a list of upcoming features with consistent
 * bullet point styling across screens
 */
export const FeatureList: React.FC<FeatureListProps> = ({ title, features, customStyles = {} }) => {
  return (
    <View style={[commonStyles.containers.section, customStyles.container]}>
      <Text style={[commonStyles.text.h3, customStyles.title]}>{title}</Text>
      {features.map((feature, index) => (
        <Text key={index} style={[commonStyles.text.featureItem, customStyles.item]}>
          • {feature}
        </Text>
      ))}
    </View>
  );
};
