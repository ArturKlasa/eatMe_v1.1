import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, PanResponder, Animated } from 'react-native';
import { DrawerFilters } from '../components/DrawerFilters';
import type { FiltersScreenProps } from '@/types/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { modalScreenStyles } from '@/styles';

/**
 * FiltersScreen Component - Permanent Filters
 * Modal-style view similar to Daily Filters but taking more space (90% of screen)
 * Supports swipe-down gesture to close
 */
export function FiltersScreen({ navigation }: FiltersScreenProps) {
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
        <DrawerFilters onClose={handleClose} onScroll={handleScroll} />
      </Animated.View>
    </View>
  );
}

export default FiltersScreen;
