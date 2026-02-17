/**
 * Dish Markers Component - Simple dish markers on map
 */

import React from 'react';
import { View, Text } from 'react-native';
import { PointAnnotation } from '@rnmapbox/maps';

// Dish type from mobile hooks
interface Dish {
  id: string;
  name: string;
  coordinates: [number, number];
  price: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
}

interface DishMarkersProps {
  dishes: Dish[];
  onMarkerPress: (dish: Dish) => void;
}

export const DishMarkers: React.FC<DishMarkersProps> = ({ dishes, onMarkerPress }) => {
  const getEmoji = (cuisine: string) => {
    if (cuisine.includes('Mexican')) return '🌮';
    if (cuisine.includes('Italian')) return '🍝';
    if (cuisine.includes('Seafood')) return '🐟';
    return '🍽️';
  };

  return (
    <>
      {dishes.map(dish => (
        <PointAnnotation
          key={dish.id}
          id={dish.id}
          coordinate={dish.coordinates}
          onSelected={() => onMarkerPress(dish)}
        >
          <View style={styles.marker}>
            <Text style={styles.emoji}>{getEmoji(dish.cuisine)}</Text>
          </View>
        </PointAnnotation>
      ))}
    </>
  );
};

const styles = {
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF9800', // Orange background
    borderWidth: 2,
    borderColor: '#FFF',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  emoji: {
    fontSize: 12,
    textAlign: 'center' as const,
  },
};
