import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { ProfileScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';
import { useAuthStore } from '../stores/authStore';
import { useFilterStore } from '../stores/filterStore';
import { supabase } from '../lib/supabase';

/**
 * ProfileScreen Component
 *
 * User profile screen with authentication integration.
 * Shows user info and sign out option.
 */
export function ProfileScreen({ navigation }: ProfileScreenProps) {
  // Use shallow selectors to prevent re-renders
  const user = useAuthStore(state => state.user);
  const signOut = useAuthStore(state => state.signOut);
  const isLoading = useAuthStore(state => state.isLoading);
  const permanent = useFilterStore(state => state.permanent);

  const translateY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);

  const [stats, setStats] = useState({
    interactions: 0,
    likes: 0,
    dislikes: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Load user stats
  useEffect(() => {
    loadUserStats();
  }, [user]);

  async function loadUserStats() {
    if (!user) {
      setLoadingStats(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_dish_interactions')
        .select('interaction_type')
        .eq('user_id', user.id);

      if (!error && data) {
        const likes = data.filter(i => i.interaction_type === 'liked').length;
        const dislikes = data.filter(i => i.interaction_type === 'disliked').length;
        setStats({
          interactions: data.length,
          likes,
          dislikes,
        });
      }
    } catch (error) {
      console.error('[Profile] Failed to load stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }

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

  const handleEditProfile = () => {
    navigation.navigate('ProfileEdit' as any);
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await signOut();
          if (error) {
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  };

  // Get active filter summary
  const getFilterSummary = (): string[] => {
    const summary: string[] = [];

    if (permanent.dietPreference !== 'all') {
      summary.push(
        permanent.dietPreference.charAt(0).toUpperCase() + permanent.dietPreference.slice(1)
      );
    }

    const activeAllergies = Object.entries(permanent.allergies)
      .filter(([_, active]) => active)
      .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1));
    if (activeAllergies.length > 0) {
      summary.push(`Allergic to ${activeAllergies.join(', ')}`);
    }

    const activeRestrictions = Object.entries(permanent.religiousRestrictions)
      .filter(([_, active]) => active)
      .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1));
    if (activeRestrictions.length > 0) {
      summary.push(activeRestrictions.join(', '));
    }

    return summary.length > 0 ? summary : ['No dietary restrictions'];
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
              <Text style={modalScreenStyles.avatarText}>
                {user?.user_metadata?.profile_name?.charAt(0).toUpperCase() || '👤'}
              </Text>
            </View>
            <Text style={modalScreenStyles.userName}>
              {user?.user_metadata?.profile_name || user?.user_metadata?.name || 'Food Explorer'}
            </Text>
            <Text style={modalScreenStyles.userSubtitle}>{user?.email || 'Guest'}</Text>

            {user && (
              <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Preferences Section */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>Dietary Preferences</Text>
            <View style={modalScreenStyles.sectionContent}>
              {getFilterSummary().map((pref, index) => (
                <Text key={index} style={modalScreenStyles.preferenceText}>
                  • {pref}
                </Text>
              ))}
            </View>
          </View>

          {/* Stats Section */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>Your Activity</Text>
            {loadingStats ? (
              <ActivityIndicator color="#FF9800" />
            ) : (
              <View style={modalScreenStyles.statsGrid}>
                <View style={modalScreenStyles.statItem}>
                  <Text style={modalScreenStyles.statNumber}>{stats.interactions}</Text>
                  <Text style={modalScreenStyles.statLabel}>Total Swipes</Text>
                </View>
                <View style={modalScreenStyles.statItem}>
                  <Text style={modalScreenStyles.statNumber}>{stats.likes}</Text>
                  <Text style={modalScreenStyles.statLabel}>Dishes Liked</Text>
                </View>
                <View style={modalScreenStyles.statItem}>
                  <Text style={modalScreenStyles.statNumber}>{stats.dislikes}</Text>
                  <Text style={modalScreenStyles.statLabel}>Dishes Passed</Text>
                </View>
                <View style={modalScreenStyles.statItem}>
                  <Text style={modalScreenStyles.statNumber}>
                    {stats.interactions > 0
                      ? Math.round((stats.likes / stats.interactions) * 100)
                      : 0}
                    %
                  </Text>
                  <Text style={modalScreenStyles.statLabel}>Like Rate</Text>
                </View>
              </View>
            )}
          </View>

          {/* Account Actions */}
          {user && (
            <View style={modalScreenStyles.section}>
              <Text style={modalScreenStyles.sectionTitle}>Account</Text>
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          )}

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

const styles = StyleSheet.create({
  editButton: {
    marginTop: 16,
    backgroundColor: '#FF9800',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF5722',
  },
  signOutButtonText: {
    color: '#FF5722',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ProfileScreen;
