import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { RootNavigator } from './src/navigation';
import 'react-native-gesture-handler'; // Required for React Navigation

/**
 * Main App component for EatMe mobile application
 *
 * Updated to use React Navigation with drawer-based navigation structure.
 * Includes proper gesture handling and safe area management.
 *
 * Navigation Structure:
 * - Root Navigator (Stack) -> Drawer Navigator -> Individual Screens
 * - Map, Filters, Favorites, Profile, Settings
 */
export default function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <RootNavigator />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
