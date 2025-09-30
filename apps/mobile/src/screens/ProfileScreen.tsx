import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { commonStyles } from '@/styles';
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

  return (
    <View style={commonStyles.containers.screen}>
      <View style={commonStyles.headers.container}>
        <View style={commonStyles.mapStyles.headerContent}>
          <TouchableOpacity style={commonStyles.buttons.iconButton} onPress={handleBackPress}>
            <Text>Back</Text>
          </TouchableOpacity>
          <View style={commonStyles.mapStyles.headerText}>
            <Text style={commonStyles.headers.title}>Profile</Text>
            <Text style={commonStyles.headers.subtitle}>Your Food Journey</Text>
          </View>
          <View style={commonStyles.buttons.iconButton} />
        </View>
      </View>

      <ScrollView style={commonStyles.containers.content}>
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
        <View style={commonStyles.containers.section}>
          <Text style={commonStyles.text.h3}>Food Preferences</Text>
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
        </View>

        {/* Stats Section */}
        <View style={commonStyles.containers.section}>
          <Text style={commonStyles.text.h3}>Your Stats</Text>
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
        </View>

        {/* Future Features */}
        <View style={commonStyles.containers.section}>
          <Text style={commonStyles.text.h3}>Coming Soon</Text>
          <Text style={commonStyles.text.featureItem}>• Real user authentication</Text>
          <Text style={commonStyles.text.featureItem}>• Personalized recommendations</Text>
          <Text style={commonStyles.text.featureItem}>• Dining history tracking</Text>
          <Text style={commonStyles.text.featureItem}>• Social features & sharing</Text>
          <Text style={commonStyles.text.featureItem}>• Achievement badges</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default ProfileScreen;
