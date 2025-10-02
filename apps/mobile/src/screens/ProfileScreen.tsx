import React from 'react';
import { View, Text } from 'react-native';
import { commonStyles } from '@/styles';
import { ScreenLayout, SectionContainer, FeatureList } from '@/components/common';
import type { ProfileScreenProps } from '@/types/navigation';

/**
 * ProfileScreen Component
 *
 * Placeholder screen for user profile and preferences.
 * Will be enhanced with authentication integration in later tasks.
 */
export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const handleBackPress = () => {
    navigation.navigate('Map');
  };

  const comingSoonFeatures = [
    'Real user authentication',
    'Personalized recommendations',
    'Dining history tracking',
    'Social features & sharing',
    'Achievement badges',
  ];

  return (
    <ScreenLayout
      title="Profile"
      subtitle="Your Food Journey"
      onBackPress={handleBackPress}
      backButtonText="Back"
    >
      {/* Mock User Profile Section */}
      <View
        style={[
          commonStyles.containers.centerHorizontal,
          commonStyles.spacingUtils.paddingBase,
          { paddingTop: 30, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
        ]}
      >
        <View style={commonStyles.profile.avatar}>
          <Text style={commonStyles.profile.avatarText}>👤</Text>
        </View>
        <Text style={commonStyles.profile.userName}>Food Explorer</Text>
        <Text style={commonStyles.profile.userSubtitle}>Mock User Profile</Text>
      </View>

      {/* Preferences Section */}
      <SectionContainer title="Food Preferences">
        <Text style={commonStyles.text.bodySmall}>🍕 Italian Cuisine: 85% match</Text>
        <Text style={[commonStyles.text.bodySmall, commonStyles.spacingUtils.marginBottomSM]}>
          🌮 Mexican Food: 78% match
        </Text>
        <Text style={[commonStyles.text.bodySmall, commonStyles.spacingUtils.marginBottomSM]}>
          🍣 Seafood: 72% match
        </Text>
        <Text style={[commonStyles.text.bodySmall, { paddingLeft: 8 }]}>
          🥗 Healthy Options: 91% match
        </Text>
      </SectionContainer>

      {/* Stats Section */}
      <SectionContainer title="Your Stats">
        <View style={commonStyles.profile.statsGrid}>
          <View style={commonStyles.profile.statItem}>
            <Text style={commonStyles.profile.statNumber}>0</Text>
            <Text style={commonStyles.profile.statLabel}>Restaurants Visited</Text>
          </View>
          <View style={commonStyles.profile.statItem}>
            <Text style={commonStyles.profile.statNumber}>0</Text>
            <Text style={commonStyles.profile.statLabel}>Dishes Tried</Text>
          </View>
          <View style={commonStyles.profile.statItem}>
            <Text style={commonStyles.profile.statNumber}>0</Text>
            <Text style={commonStyles.profile.statLabel}>Reviews Written</Text>
          </View>
          <View style={commonStyles.profile.statItem}>
            <Text style={commonStyles.profile.statNumber}>0</Text>
            <Text style={commonStyles.profile.statLabel}>Friends Connected</Text>
          </View>
        </View>
      </SectionContainer>

      {/* Future Features */}
      <FeatureList title="Coming Soon" features={comingSoonFeatures} />
    </ScreenLayout>
  );
};

export default ProfileScreen;
