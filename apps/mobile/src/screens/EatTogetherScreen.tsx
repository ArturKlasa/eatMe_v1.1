import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { EatTogetherScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';
import { useAuthStore } from '../stores/authStore';

/**
 * EatTogetherScreen Component
 *
 * Main entry screen for group dining features.
 * Allows users to create or join Eat Together sessions.
 */
export function EatTogetherScreen({ navigation }: EatTogetherScreenProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);
  const user = useAuthStore(state => state.user);

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
    '✅ Find restaurants for groups (LIVE)',
    '✅ Democratic voting system (LIVE)',
    '✅ Location-based recommendations (LIVE)',
    'Friend system and favorites',
    'Split the bill with friends',
    'Chat and coordination features',
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
          {user ? (
            <>
              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={() => navigation.navigate('CreateSession' as any)}
                >
                  <Text style={styles.actionIcon}>🎯</Text>
                  <Text style={styles.actionTitle}>Start Eat Together</Text>
                  <Text style={styles.actionDescription}>
                    Create a session and invite friends to find the perfect restaurant for everyone
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => navigation.navigate('JoinSession' as any)}
                >
                  <Text style={styles.actionIcon}>🔗</Text>
                  <Text style={styles.actionTitle}>Join Session</Text>
                  <Text style={styles.actionDescription}>
                    Enter a code or scan QR to join an existing session
                  </Text>
                </TouchableOpacity>
              </View>

              {/* How It Works */}
              <View style={modalScreenStyles.section}>
                <Text style={modalScreenStyles.sectionTitle}>How It Works</Text>
                <View style={styles.stepsList}>
                  {[
                    { icon: '1️⃣', text: 'Create or join a session with friends' },
                    { icon: '2️⃣', text: 'Everyone shares their location and dietary preferences' },
                    { icon: '3️⃣', text: 'Get top 5 restaurants that work for ALL members' },
                    { icon: '4️⃣', text: 'Vote democratically for your favorite' },
                    { icon: '5️⃣', text: 'See the winner and navigate together!' },
                  ].map((step, index) => (
                    <View key={index} style={styles.stepItem}>
                      <Text style={styles.stepIcon}>{step.icon}</Text>
                      <Text style={styles.stepText}>{step.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            /* Not Signed In */
            <View style={modalScreenStyles.emptyState}>
              <Text style={modalScreenStyles.emptyIcon}>🔒</Text>
              <Text style={modalScreenStyles.emptyTitle}>Sign In Required</Text>
              <Text style={modalScreenStyles.emptyDescription}>
                Create an account to use Eat Together and find restaurants with friends.
              </Text>
            </View>
          )}

          {/* Planned Features */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>Features</Text>
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

const styles = StyleSheet.create({
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  primaryAction: {
    backgroundColor: '#FF9800',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryAction: {
    backgroundColor: '#2A2A2A',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  actionIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  actionTitle: {
    color: '#E0E0E0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  actionDescription: {
    color: '#E0E0E0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  stepIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  stepText: {
    color: '#E0E0E0',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});

export default EatTogetherScreen;
