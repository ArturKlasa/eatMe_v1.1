import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Main App component for EatMe mobile application
 *
 * This is the root component that will be expanded to include:
 * - Navigation setup (React Navigation)
 * - Map integration (Mapbox)
 * - State management (Zustand)
 * - Authentication flows
 */
export default function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>EatMe - Food Discovery</Text>
      <Text style={styles.subtitle}>Mobile app prototype coming soon!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
