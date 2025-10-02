import React from 'react';
import { View, Text } from 'react-native';
import { commonStyles } from '@/styles';
import { ScreenLayout, SectionContainer, SettingItem, FeatureList } from '@/components/common';
import type { SettingsScreenProps } from '@/types/navigation';

/**
 * SettingsScreen Component
 *
 * Placeholder screen for app settings and preferences.
 * Will be enhanced with actual settings functionality in later tasks.
 */
export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [locationEnabled, setLocationEnabled] = React.useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = React.useState(false);

  const handleBackPress = () => {
    navigation.navigate('Map');
  };

  const comingSoonFeatures = [
    'Account management',
    'Dietary preferences setup',
    'Language selection',
    'Units (metric/imperial)',
    'Theme customization',
    'Backup & sync',
  ];

  return (
    <ScreenLayout
      title="Settings"
      subtitle="Customize Your Experience"
      onBackPress={handleBackPress}
      backButtonText="Back"
    >
      {/* App Preferences */}
      <SectionContainer title="App Preferences">
        <SettingItem
          label="Push Notifications"
          description="Get notified about nearby restaurants"
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
        />

        <SettingItem
          label="Location Services"
          description="Allow location for better recommendations"
          value={locationEnabled}
          onValueChange={setLocationEnabled}
        />

        <SettingItem
          label="Dark Mode"
          description="Switch to dark theme"
          value={darkModeEnabled}
          onValueChange={setDarkModeEnabled}
        />
      </SectionContainer>

      {/* Data & Privacy */}
      <SectionContainer title="Data & Privacy">
        <View style={commonStyles.spacingUtils.paddingVerticalMD}>
          <Text style={commonStyles.forms.settingLabel}>Clear Search History</Text>
        </View>
        <View style={commonStyles.spacingUtils.paddingVerticalMD}>
          <Text style={commonStyles.forms.settingLabel}>Export My Data</Text>
        </View>
        <View style={commonStyles.spacingUtils.paddingVerticalMD}>
          <Text style={commonStyles.forms.settingLabel}>Privacy Policy</Text>
        </View>
      </SectionContainer>

      {/* About */}
      <SectionContainer title="About">
        <Text style={commonStyles.text.bodySmall}>EatMe - Food Discovery App</Text>
        <Text style={commonStyles.text.bodySmall}>Version 1.0.0 (Beta)</Text>
        <Text style={commonStyles.text.bodySmall}>Phase 1 - Mobile UI Prototype</Text>
      </SectionContainer>

      {/* Coming Soon */}
      <FeatureList title="Coming Soon" features={comingSoonFeatures} />
    </ScreenLayout>
  );
};

export default SettingsScreen;
