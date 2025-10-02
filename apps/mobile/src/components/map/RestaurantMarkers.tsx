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
              },
            ]}
          >
            <View style={commonStyles.mapStyles.markerInner}>
              <Text style={commonStyles.mapStyles.markerText}>🍽️</Text>
            </View>
          </View>
        </PointAnnotation>
      ))}
    </>
  );
};
