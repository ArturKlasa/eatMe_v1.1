import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';
import { updateProfileName } from '../services/userPreferencesService';

/**
 * ProfileEditScreen - Edit user profile and preferences
 */
export function ProfileEditScreen() {
  const navigation = useNavigation();

  // Use shallow selectors to prevent re-renders
  const user = useAuthStore(state => state.user);

  const [profileName, setProfileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Load current profile name from user metadata
    if (user?.user_metadata?.profile_name) {
      setProfileName(user.user_metadata.profile_name);
    }
  }, [user]);

  const validateProfileName = (name: string): boolean => {
    if (name.length < 3 || name.length > 12) {
      Alert.alert('Invalid Name', 'Profile name must be 3-12 characters');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate profile name if changed
    if (profileName !== user.user_metadata?.profile_name) {
      if (!validateProfileName(profileName)) return;
    }

    setIsSaving(true);
    setHasChanges(false);

    try {
      // Update profile name if changed
      if (profileName !== user.user_metadata?.profile_name) {
        const { error: nameError } = await updateProfileName(user.id, profileName);
        if (nameError) {
          Alert.alert('Error', 'Failed to update profile name');
          setIsSaving(false);
          return;
        }

        // Update auth metadata
        await useAuthStore.getState().updateProfile({ profile_name: profileName });
      }

      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error) {
      console.error('[ProfileEdit] Save error:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const markChanged = () => setHasChanges(true);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Please sign in to edit your profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.headerButton, isSaving && styles.headerButtonDisabled]}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FF9800" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.emailText}>{user.email}</Text>

            <Text style={styles.label}>Profile Name</Text>
            <TextInput
              style={styles.input}
              value={profileName}
              onChangeText={text => {
                setProfileName(text);
                markChanged();
              }}
              placeholder="Your display name"
              placeholderTextColor="#666"
              maxLength={12}
              autoCapitalize="none"
            />
            <Text style={styles.hint}>3-12 characters • Used in social features</Text>
          </View>
        </View>

        {/* Info about permanent filters */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>💡 Diet Preferences & Restrictions</Text>
            <Text style={styles.infoText}>
              To manage your diet preferences, allergies, and restrictions, go to the Filters screen
              and tap "Permanent Filters".
            </Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerButton: {
    padding: 8,
    minWidth: 60,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    color: '#B0B0B0',
    fontSize: 16,
  },
  saveButtonText: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#E0E0E0',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  label: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
  },
  emailText: {
    color: '#999',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#E0E0E0',
  },
  hint: {
    color: '#999',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF9800',
  },
  radioLabel: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  infoTitle: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#B0B0B0',
    fontSize: 14,
    lineHeight: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF5722',
    fontSize: 16,
  },
  bottomPadding: {
    height: 40,
  },
});
