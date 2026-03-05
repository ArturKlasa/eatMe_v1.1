import { useRef } from 'react';
import { PanResponder, Animated } from 'react-native';

/**
 * useSwipeToClose
 *
 * Provides a PanResponder and Animated.Value that implement the standard
 * swipe-down-to-close gesture used by modal screens (FiltersScreen,
 * FavoritesScreen, etc.).
 *
 * @param onClose - Callback invoked after the close animation completes
 * @returns `{ translateY, panResponder, handleScroll }` — spread
 *   `{...panResponder.panHandlers}` onto the Animated.View and pass
 *   `handleScroll` to the inner ScrollView's `onScroll` prop.
 */
export function useSwipeToClose(onClose: () => void) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Only respond if scrolled to top and dragging down
        return scrollOffsetY.current <= 0 && gestureState.dy > 5;
      },
      onPanResponderMove: (_evt, gestureState) => {
        // Only allow downward drag
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > 100) {
          // Dragged far enough — animate off-screen then close
          Animated.timing(translateY, {
            toValue: 1000,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else {
          // Not far enough — snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  };

  return { translateY, panResponder, handleScroll };
}
