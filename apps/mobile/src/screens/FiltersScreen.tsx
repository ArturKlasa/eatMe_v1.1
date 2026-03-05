import React from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { DrawerFilters } from '../components/DrawerFilters';
import type { FiltersScreenProps } from '@/types/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { modalScreenStyles } from '@/styles';
import { useSwipeToClose } from '../hooks';

/**
 * FiltersScreen Component - Permanent Filters
 * Modal-style view similar to Daily Filters but taking more space (90% of screen)
 * Supports swipe-down gesture to close
 */
export function FiltersScreen({ navigation }: FiltersScreenProps) {
  const handleClose = () => navigation.navigate('Map');
  const { translateY, panResponder, handleScroll } = useSwipeToClose(handleClose);

  // Reset animation when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      translateY.setValue(0);
    }, [translateY])
  );

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
