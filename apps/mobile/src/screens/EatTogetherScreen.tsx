import React, { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { EatTogetherScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';

/**
 * EatTogetherScreen Component
 *
 * Placeholder screen for group dining and social features.
 * Will be enhanced with friend system and group recommendations in later phases.
 */
export function EatTogetherScreen({ navigation }: EatTogetherScreenProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);

  useFocusEffect(
    React.useCallback(() => {
      translateY.setValue(0);
      scrollOffsetY.current = 0;
    }, [translateY])
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return scrollOffsetY.current <= 0 && gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (scrollOffsetY.current <= 0 && gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          navigation.navigate('Map');
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleScroll = (event: any) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  };

  const comingSoonFeatures = [
    'Invite friends to join your dining plans',
    'Share restaurant recommendations',
    'Group voting for restaurant selection',
    'Coordinate meeting times and locations',
    'Split the bill with friends',
    "View friends' favorite restaurants",
  ];

  return (
    <View style={modalScreenStyles.container}>
      <TouchableOpacity
        style={modalScreenStyles.overlay}
        activeOpacity={1}
        onPress={() => navigation.navigate('Map')}
      />
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

        <View style={modalScreenStyles.header}>
          <Text style={modalScreenStyles.title}>Eat Together</Text>
          <Text style={modalScreenStyles.subtitle}>Group Dining Made Easy</Text>
        </View>

        <ScrollView
          style={modalScreenStyles.scrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Empty State */}
          <View style={modalScreenStyles.emptyState}>
            <Text style={modalScreenStyles.emptyIcon}>👥</Text>
            <Text style={modalScreenStyles.emptyTitle}>Coming Soon!</Text>
            <Text style={modalScreenStyles.emptyDescription}>
              Connect with friends and make group dining decisions easier.
            </Text>
          </View>

          {/* Planned Features */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>Planned Features</Text>
            <View style={modalScreenStyles.sectionContent}>
              {comingSoonFeatures.map((feature, index) => (
                <View key={index} style={modalScreenStyles.featureItem}>
                  <Text style={modalScreenStyles.featureBullet}>•</Text>
                  <Text style={modalScreenStyles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Info Section */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>How It Will Work</Text>
            <View style={modalScreenStyles.sectionContent}>
              <View style={modalScreenStyles.featureItem}>
                <Text style={modalScreenStyles.featureBullet}>1.</Text>
                <Text style={modalScreenStyles.featureText}>Create or join a dining group</Text>
              </View>
              <View style={modalScreenStyles.featureItem}>
                <Text style={modalScreenStyles.featureBullet}>2.</Text>
                <Text style={modalScreenStyles.featureText}>Share preferences and suggestions</Text>
              </View>
              <View style={modalScreenStyles.featureItem}>
                <Text style={modalScreenStyles.featureBullet}>3.</Text>
                <Text style={modalScreenStyles.featureText}>Vote on restaurants together</Text>
              </View>
              <View style={modalScreenStyles.featureItem}>
                <Text style={modalScreenStyles.featureBullet}>4.</Text>
                <Text style={modalScreenStyles.featureText}>
                  Get personalized group recommendations
                </Text>
              </View>
            </View>
          </View>

          <View style={modalScreenStyles.bottomSpacer} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export default EatTogetherScreen;
