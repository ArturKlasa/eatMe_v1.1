import React from 'react';
import { View, ScrollView } from 'react-native';
import { commonStyles } from '@/styles';
import { ScreenHeader } from './ScreenHeader';

interface ScreenLayoutProps {
  title: string;
  subtitle?: string;
  onBackPress: () => void;
  backButtonText?: string;
  rightComponent?: React.ReactNode;
  children: React.ReactNode;
  scrollable?: boolean;
  customStyles?: {
    container?: any;
    content?: any;
  };
}

/**
 * Reusable Screen Layout Component
 *
 * Provides consistent screen structure with:
 * - Header with navigation
 * - Content area (scrollable or fixed)
 * - Consistent styling and spacing
 */
export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  title,
  subtitle,
  onBackPress,
  backButtonText,
  rightComponent,
  children,
  scrollable = true,
  customStyles = {},
}) => {
  const ContentWrapper = scrollable ? ScrollView : View;
  const contentStyle = scrollable
    ? commonStyles.containers.content
    : commonStyles.containers.screen;

  return (
    <View style={[commonStyles.containers.screen, customStyles.container]}>
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        onBackPress={onBackPress}
        backButtonText={backButtonText}
        rightComponent={rightComponent}
      />
      <ContentWrapper style={[contentStyle, customStyles.content]}>{children}</ContentWrapper>
    </View>
  );
};
