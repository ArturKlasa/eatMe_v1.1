import React, { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, PanResponder, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ navigation }) => {
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
    'Favorite restaurants list',
    'Liked dishes collection',
    'Personal taste preferences',
    'Quick access from map',
    'Share favorites with friends',
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
          <Text style={modalScreenStyles.title}>Favorites</Text>
          <Text style={modalScreenStyles.subtitle}>Your Saved Places</Text>
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
            <Text style={modalScreenStyles.emptyTitle}>No Favorites Yet</Text>
            <Text style={modalScreenStyles.emptyDescription}>
              Start swiping on dishes and liking restaurants to build your personal collection!
            </Text>
          </View>

          {/* Coming Soon Features */}
          <View style={modalScreenStyles.featuresContainer}>
            <Text style={modalScreenStyles.featuresTitle}>Coming Soon:</Text>
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
};

export default FavoritesScreen;
