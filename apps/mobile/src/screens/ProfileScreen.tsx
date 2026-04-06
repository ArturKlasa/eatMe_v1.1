import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { styles } from './ProfileScreen.styles';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProfileScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';
import { useAuthStore } from '../stores/authStore';
import { useFilterStore } from '../stores/filterStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { ProfileCompletionCard } from '../components/ProfileCompletionCard';

/**
 * ProfileScreen Component
 *
 * User profile screen with authentication integration.
 * Shows user info and sign out option.
 */
export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Use shallow selectors to prevent re-renders
  const user = useAuthStore(state => state.user);
  const signOut = useAuthStore(state => state.signOut);
  const isLoading = useAuthStore(state => state.isLoading);
  const permanent = useFilterStore(state => state.permanent);
  const { isCompleted, profileCompletion } = useOnboardingStore();

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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  };

  const handleEditProfile = () => {
    navigation.navigate('ProfileEdit');
  };

  const handleCustomizePreferences = () => {
    navigation.navigate('OnboardingStep1');
  };

  const handleSignOut = async () => {
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOutButton'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await signOut();
          if (error) {
            Alert.alert(t('common.error'), t('profile.signOutFailed'));
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

    return summary.length > 0 ? summary : [t('profile.noDietRestrictions')];
  };

  const comingSoonFeatures = [
    t('profile.comingSoon1'),
    t('profile.comingSoon2'),
    t('profile.comingSoon3'),
    t('profile.comingSoon4'),
    t('profile.comingSoon5'),
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
          <Text style={modalScreenStyles.title}>{t('profile.title')}</Text>
          <Text style={modalScreenStyles.subtitle}>{t('profile.subtitle')}</Text>
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
              {user?.user_metadata?.profile_name ||
                user?.user_metadata?.name ||
                t('profile.defaultName')}
            </Text>
            <Text style={modalScreenStyles.userSubtitle}>{user?.email || t('profile.guest')}</Text>

            {user && (
              <>
                <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
                  <Text style={styles.editButtonText}>{t('profile.editProfile')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editButton, { marginTop: 8 }]}
                  onPress={handleCustomizePreferences}
                >
                  <Text style={styles.editButtonText}>{t('profile.customizePreferences')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editButton, { marginTop: 8 }]}
                  onPress={() => navigation.navigate('ViewedHistory')}
                >
                  <Text style={styles.editButtonText}>{t('profile.viewedHistory')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Profile Completion Card */}
          {user && !isCompleted && (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <ProfileCompletionCard onPress={() => navigation.navigate('OnboardingStep1')} />
            </View>
          )}

          {/* Preferences Section */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>{t('profile.dietaryPreferences')}</Text>
            <View style={modalScreenStyles.sectionContent}>
              {getFilterSummary().map((pref, index) => (
                <Text key={index} style={modalScreenStyles.preferenceText}>
                  • {pref}
                </Text>
              ))}
            </View>
          </View>

          {/* Account Actions */}
          {user && (
            <View style={modalScreenStyles.section}>
              <Text style={modalScreenStyles.sectionTitle}>{t('profile.account')}</Text>
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutButtonText}>{t('auth.signOut')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Coming Soon Section */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>{t('settings.comingSoon')}</Text>
            <View style={modalScreenStyles.sectionContent}>
              {comingSoonFeatures.map((feature, index) => (
                <View key={index} style={modalScreenStyles.featureItem}>
                  <Text style={modalScreenStyles.featureBullet}>•</Text>
                  <Text style={modalScreenStyles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: Math.max(40, insets.bottom + 20) }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export default ProfileScreen;
