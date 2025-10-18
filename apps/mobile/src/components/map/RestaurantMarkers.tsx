/**
 * Restaurant Markers Component
 *
 * Renders restaurant markers on the map with proper styling and interactions
 */

import React from 'react';
import { View, Text } from 'react-native';
import { PointAnnotation } from '@rnmapbox/maps';
import { Restaurant } from '../../data/mockRestaurants';
import { commonStyles, theme } from '@/styles';

interface RestaurantMarkersProps {
  restaurants: Restaurant[];
  onMarkerPress: (restaurant: Restaurant) => void;
}

export const RestaurantMarkers: React.FC<RestaurantMarkersProps> = ({
  restaurants,
  onMarkerPress,
}) => {
  // Add debugging
  console.log('RestaurantMarkers received:', restaurants.length, 'restaurants');
  restaurants.forEach((restaurant, index) => {
    console.log(`Restaurant ${index + 1}:`, restaurant.name, 'at', restaurant.coordinates);
  });

  return (
    <>
      {restaurants.map(restaurant => (
        <PointAnnotation
          key={restaurant.id}
          id={restaurant.id}
          coordinate={restaurant.coordinates}
          onSelected={() => onMarkerPress(restaurant)}
        >
          <View
            style={[
              commonStyles.mapStyles.markerContainer,
              {
                backgroundColor: restaurant.isOpen
                  ? theme.colors.mapMarkerOpen
                  : theme.colors.mapMarkerClosed,
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 2,
                borderColor: '#FFFFFF',
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
          >
            <View
              style={[
                commonStyles.mapStyles.markerInner,
                {
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <Text
                style={[
                  commonStyles.mapStyles.markerText,
                  {
                    fontSize: 12,
                    textAlign: 'center',
                    lineHeight: 12,
                  },
                ]}
              >
                🍽️
              </Text>
            </View>
          </View>
        </PointAnnotation>
      ))}
    </>
  );
};
