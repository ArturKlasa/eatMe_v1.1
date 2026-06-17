/**
 * Dish Markers Component - dish pins on the map
 *
 * Renders one teardrop pin per dish, carrying the dish's cuisine emoji. The set
 * of dishes is already capped to the recommended ~5 (one per restaurant) by the
 * caller, so this component just draws what it's given.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { PointAnnotation } from '@rnmapbox/maps';
import { colors } from '@eatme/tokens';
import { cuisineEmoji } from '@/utils/cuisineEmoji';

// Dish type from mobile hooks
interface Dish {
  id: string;
  name: string;
  coordinates: [number, number];
  price: number;
  restaurantId: string;
  cuisine: string;
}

interface DishMarkersProps {
  dishes: Dish[];
  onMarkerPress: (dish: Dish) => void;
}

export const DishMarkers = React.memo<DishMarkersProps>(function DishMarkers({
  dishes,
  onMarkerPress,
}) {
  return (
    <>
      {dishes.map(dish => (
        <PointAnnotation
          key={dish.id}
          id={dish.id}
          coordinate={dish.coordinates}
          // Bottom-center of the view (the teardrop's tip) marks the coordinate.
          anchor={{ x: 0.5, y: 1 }}
          onSelected={() => onMarkerPress(dish)}
        >
          <View style={styles.pinWrap}>
            <View style={styles.pin}>
              <View style={styles.emojiWrap}>
                <Text style={styles.emoji}>{cuisineEmoji(dish.cuisine)}</Text>
              </View>
            </View>
          </View>
        </PointAnnotation>
      ))}
    </>
  );
});

const styles = {
  // Padding around the pin so the drop-shadow isn't clipped by the
  // PointAnnotation view snapshot on Android.
  pinWrap: {
    padding: 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  // Teardrop: a rounded square with one sharp corner, rotated 45° so the sharp
  // corner points down to the coordinate.
  pin: {
    width: 34,
    height: 34,
    backgroundColor: colors.accent,
    borderColor: colors.white,
    borderWidth: 2,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    borderBottomLeftRadius: 17,
    borderBottomRightRadius: 2,
    transform: [{ rotate: '45deg' }],
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  // Counter-rotate the emoji so it sits upright inside the rotated pin.
  emojiWrap: {
    transform: [{ rotate: '-45deg' }],
  },
  emoji: {
    fontSize: 16,
    textAlign: 'center' as const,
  },
};
