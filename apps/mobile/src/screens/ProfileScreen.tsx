import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { ProfileScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';
import { useAuthStore } from '../stores/authStore';

/**
 * ProfileScreen Component
 *
 * User profile screen with authentication integration.
 * Shows user info and sign out option.
 */
export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, signOut, isLoading } = useAuthStore();
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
    'Real user authentication',
    'Personalized recommendations',
    'Dining history tracking',
    'Social features & sharing',
    'Achievement badges',
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
          <Text style={modalScreenStyles.title}>Profile</Text>
          <Text style={modalScreenStyles.subtitle}>Your Food Journey</Text>
        </View>

        <ScrollView
          style={modalScreenStyles.scrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* User Profile Section */}
          <View style={modalScreenStyles.profileSection}>
            <View style={modalScreenStyles.avatar}>
              <Text style={modalScreenStyles.avatarText}>👤</Text>
            </View>
            <Text style={modalScreenStyles.userName}>
              {user?.user_metadata?.name || 'Food Explorer'}
            </Text>
            <Text style={modalScreenStyles.userSubtitle}>{user?.email || 'Signed in user'}</Text>
          </View>

          {/* Preferences Section */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>Food Preferences</Text>
            <View style={modalScreenStyles.sectionContent}>
              <Text style={modalScreenStyles.preferenceText}>🍕 Italian Cuisine: 85% match</Text>
              <Text style={modalScreenStyles.preferenceText}>🌮 Mexican Food: 78% match</Text>
              <Text style={modalScreenStyles.preferenceText}>🍣 Seafood: 72% match</Text>
              <Text style={modalScreenStyles.preferenceText}>🥗 Healthy Options: 91% match</Text>
            </View>
          </View>

          {/* Stats Section */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>Your Stats</Text>
            <View style={modalScreenStyles.statsGrid}>
              <View style={modalScreenStyles.statItem}>
                <Text style={modalScreenStyles.statNumber}>0</Text>
                <Text style={modalScreenStyles.statLabel}>Restaurants Visited</Text>
              </View>
              <View style={modalScreenStyles.statItem}>
                <Text style={modalScreenStyles.statNumber}>0</Text>
                <Text style={modalScreenStyles.statLabel}>Dishes Tried</Text>
              </View>
              <View style={modalScreenStyles.statItem}>
                <Text style={modalScreenStyles.statNumber}>0</Text>
                <Text style={modalScreenStyles.statLabel}>Reviews Written</Text>
              </View>
              <View style={modalScreenStyles.statItem}>
                <Text style={modalScreenStyles.statNumber}>0</Text>
                <Text style={modalScreenStyles.statLabel}>Friends Connected</Text>
              </View>
            </View>
          </View>

          {/* Coming Soon Section */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>Coming Soon</Text>
            <View style={modalScreenStyles.sectionContent}>
              {comingSoonFeatures.map((feature, index) => (
                <View key={index} style={modalScreenStyles.featureItem}>
                  <Text style={modalScreenStyles.featureBullet}>•</Text>
                  <Text style={modalScreenStyles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={modalScreenStyles.bottomSpacer} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export default ProfileScreen;
