import React, { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, PanResponder, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { FavoritesScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';

/**
 * FavoritesScreen Component
 *
 * Placeholder screen for favorite restaurants and dishes.
 * Will be enhanced with swipe preferences integration in later tasks.
 * Dark mode styling to match the app theme.
 * Supports swipe-down gesture to close.
 */
export function FavoritesScreen({ navigation }: FavoritesScreenProps) {
  const { t } = useTranslation();
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);

  // Reset animation when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      translateY.setValue(0);
      scrollOffsetY.current = 0;
    }, [translateY])
  );

  const handleClose = () => {
    navigation.navigate('Map');
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond if scrolled to top and dragging down
        return scrollOffsetY.current <= 0 && gestureState.dy > 5;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow downward drag
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If dragged more than 100px down, close the modal
        if (gestureState.dy > 100) {
          Animated.timing(translateY, {
            toValue: 1000,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            handleClose();
          });
        } else {
          // Otherwise, snap back to original position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  const handleScroll = (event: any) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  };

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
