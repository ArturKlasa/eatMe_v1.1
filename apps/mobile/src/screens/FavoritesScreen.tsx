import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { FavoritesScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';
import { useSwipeToClose } from '../hooks';

/**
 * FavoritesScreen Component
 *
 * Placeholder screen for favorite restaurants and dishes.
 * Dark mode styling to match the app theme.
 * Supports swipe-down gesture to close.
 */
export function FavoritesScreen({ navigation }: FavoritesScreenProps) {
  const { t } = useTranslation();
  const handleClose = () => navigation.goBack();
  const { translateY, panResponder, handleScroll } = useSwipeToClose(handleClose);

  // Reset animation when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      translateY.setValue(0);
    }, [translateY])
  );

  const comingSoonFeatures = [
    t('favorites.feature1'),
    t('favorites.feature2'),
    t('favorites.feature3'),
    t('favorites.feature4'),
    t('favorites.feature5'),
  ];

  return (
    <View style={modalScreenStyles.container}>
      <TouchableOpacity style={modalScreenStyles.overlay} activeOpacity={1} onPress={handleClose} />
      <Animated.View
        style={[
          modalScreenStyles.modalContainer,
          {
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={modalScreenStyles.dragHandle} />

        {/* Header */}
        <View style={modalScreenStyles.header}>
          <Text style={modalScreenStyles.title}>{t('favorites.title')}</Text>
          <Text style={modalScreenStyles.subtitle}>{t('favorites.subtitle')}</Text>
        </View>

        {/* Content */}
        <ScrollView
          style={modalScreenStyles.scrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Empty State */}
          <View style={modalScreenStyles.emptyState}>
            <Text style={modalScreenStyles.emptyIcon}>❤️</Text>
            <Text style={modalScreenStyles.emptyTitle}>{t('favorites.empty')}</Text>
            <Text style={modalScreenStyles.emptyDescription}>{t('favorites.emptyMessage')}</Text>
          </View>

          {/* Coming Soon Features */}
          <View style={modalScreenStyles.featuresContainer}>
            <Text style={modalScreenStyles.featuresTitle}>{t('favorites.comingSoonTitle')}</Text>
            {comingSoonFeatures.map((feature, index) => (
              <Text key={index} style={modalScreenStyles.featureItem}>
                • {feature}
              </Text>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export default FavoritesScreen;
