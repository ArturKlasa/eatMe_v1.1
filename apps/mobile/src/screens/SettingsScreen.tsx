import React from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { commonStyles, switchConfig } from '@/styles';
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

  return (
    <View style={commonStyles.containers.screen}>
      <View style={commonStyles.headers.container}>
        <View style={commonStyles.mapStyles.headerContent}>
          <TouchableOpacity style={commonStyles.buttons.iconButton} onPress={handleBackPress}>
            <Text>Back</Text>
          </TouchableOpacity>
          <View style={commonStyles.mapStyles.headerText}>
            <Text style={commonStyles.headers.title}>Settings</Text>
            <Text style={commonStyles.headers.subtitle}>Customize Your Experience</Text>
          </View>
          <View style={commonStyles.buttons.iconButton} />
        </View>
      </View>

      <ScrollView style={commonStyles.containers.content}>
        {/* App Preferences */}
        <View style={commonStyles.containers.section}>
          <Text style={commonStyles.text.h3}>App Preferences</Text>

          <View style={commonStyles.forms.settingItem}>
            <View style={commonStyles.forms.settingText}>
              <Text style={commonStyles.forms.settingLabel}>Push Notifications</Text>
              <Text style={commonStyles.forms.settingDescription}>
                Get notified about nearby restaurants
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={switchConfig.trackColors}
            />
          </View>

          <View style={commonStyles.forms.settingItem}>
            <View style={commonStyles.forms.settingText}>
              <Text style={commonStyles.forms.settingLabel}>Location Services</Text>
              <Text style={commonStyles.forms.settingDescription}>
                Allow location for better recommendations
              </Text>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={switchConfig.trackColors}
            />
          </View>

          <View style={commonStyles.forms.settingItem}>
            <View style={commonStyles.forms.settingText}>
              <Text style={commonStyles.forms.settingLabel}>Dark Mode</Text>
              <Text style={commonStyles.forms.settingDescription}>Switch to dark theme</Text>
            </View>
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              trackColor={switchConfig.trackColors}
            />
          </View>
        </View>

        {/* Data & Privacy */}
        <View style={commonStyles.containers.section}>
          <Text style={commonStyles.text.h3}>Data & Privacy</Text>
          <View style={commonStyles.spacingUtils.paddingVerticalMD}>
            <Text style={commonStyles.forms.settingLabel}>Clear Search History</Text>
          </View>
          <View style={commonStyles.spacingUtils.paddingVerticalMD}>
            <Text style={commonStyles.forms.settingLabel}>Export My Data</Text>
          </View>
          <View style={commonStyles.spacingUtils.paddingVerticalMD}>
            <Text style={commonStyles.forms.settingLabel}>Privacy Policy</Text>
          </View>
        </View>

        {/* About */}
        <View style={commonStyles.containers.section}>
          <Text style={commonStyles.text.h3}>About</Text>
          <Text style={commonStyles.text.bodySmall}>EatMe - Food Discovery App</Text>
          <Text style={commonStyles.text.bodySmall}>Version 1.0.0 (Beta)</Text>
          <Text style={commonStyles.text.bodySmall}>Phase 1 - Mobile UI Prototype</Text>
        </View>

        {/* Coming Soon */}
        <View style={commonStyles.containers.section}>
          <Text style={commonStyles.text.h3}>Coming Soon</Text>
          <Text style={commonStyles.text.featureItem}>• Account management</Text>
          <Text style={commonStyles.text.featureItem}>• Dietary preferences setup</Text>
          <Text style={commonStyles.text.featureItem}>• Language selection</Text>
          <Text style={commonStyles.text.featureItem}>• Units (metric/imperial)</Text>
          <Text style={commonStyles.text.featureItem}>• Theme customization</Text>
          <Text style={commonStyles.text.featureItem}>• Backup & sync</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
