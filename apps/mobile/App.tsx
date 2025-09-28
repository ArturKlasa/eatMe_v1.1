import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import BasicMapScreen from './src/screens/BasicMapScreen';

/**
 * Main App component for EatMe mobile application
 *
 * Currently displays the basic map screen for initial Mapbox integration testing.
 *
 * This will be expanded to include:
 * - Navigation setup (React Navigation)
 * - State management (Zustand)
 * - Authentication flows
 * - Drawer navigation with filters
 */
export default function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <BasicMapScreen />
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
