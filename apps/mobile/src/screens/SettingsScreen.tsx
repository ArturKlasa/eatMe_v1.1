import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { SettingsScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';

/**
 * SettingsScreen Component
 *
 * Placeholder screen for app settings and preferences.
 * Will be enhanced with actual settings functionality in later tasks.
 */
export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [locationEnabled, setLocationEnabled] = React.useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = React.useState(false);

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
    'Account management',
    'Dietary preferences setup',
    'Language selection',
    'Units (metric/imperial)',
    'Theme customization',
    'Backup & sync',
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
          <Text style={modalScreenStyles.title}>Settings</Text>
          <Text style={modalScreenStyles.subtitle}>Customize Your Experience</Text>
        </View>

        <ScrollView
          style={modalScreenStyles.scrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* App Preferences */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>App Preferences</Text>

            <View style={modalScreenStyles.settingItem}>
              <View style={modalScreenStyles.settingContent}>
                <Text style={modalScreenStyles.settingLabel}>Push Notifications</Text>
                <Text style={modalScreenStyles.settingDescription}>
                  Get notified about nearby restaurants
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#555', true: '#FF9800' }}
                thumbColor={notificationsEnabled ? '#FFF' : '#CCC'}
              />
            </View>

            <View style={modalScreenStyles.settingItem}>
              <View style={modalScreenStyles.settingContent}>
                <Text style={modalScreenStyles.settingLabel}>Location Services</Text>
                <Text style={modalScreenStyles.settingDescription}>
                  Allow location for better recommendations
                </Text>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={setLocationEnabled}
                trackColor={{ false: '#555', true: '#FF9800' }}
                thumbColor={locationEnabled ? '#FFF' : '#CCC'}
              />
            </View>

            <View style={modalScreenStyles.settingItem}>
              <View style={modalScreenStyles.settingContent}>
                <Text style={modalScreenStyles.settingLabel}>Dark Mode</Text>
                <Text style={modalScreenStyles.settingDescription}>Switch to dark theme</Text>
              </View>
              <Switch
                value={darkModeEnabled}
                onValueChange={setDarkModeEnabled}
                trackColor={{ false: '#555', true: '#FF9800' }}
                thumbColor={darkModeEnabled ? '#FFF' : '#CCC'}
              />
            </View>
          </View>

          {/* Data & Privacy */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>Data & Privacy</Text>

            <TouchableOpacity style={modalScreenStyles.actionItem}>
              <Text style={modalScreenStyles.actionText}>Clear Search History</Text>
            </TouchableOpacity>

            <TouchableOpacity style={modalScreenStyles.actionItem}>
              <Text style={modalScreenStyles.actionText}>Export My Data</Text>
            </TouchableOpacity>

            <TouchableOpacity style={modalScreenStyles.actionItem}>
              <Text style={modalScreenStyles.actionText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>

          {/* About */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>About</Text>
            <View style={modalScreenStyles.aboutContent}>
              <Text style={modalScreenStyles.aboutText}>EatMe - Food Discovery App</Text>
              <Text style={modalScreenStyles.aboutText}>Version 1.0.0 (Beta)</Text>
              <Text style={modalScreenStyles.aboutText}>Phase 1 - Mobile UI Prototype</Text>
            </View>
          </View>

          {/* Coming Soon */}
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

export default SettingsScreen;
