import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { styles } from './ProfileEditScreen.styles';
import { colors } from '@eatme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { updateProfileName } from '../services/userPreferencesService';

/**
 * ProfileEditScreen - Edit user profile and preferences
 */
export function ProfileEditScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();

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
      Alert.alert(t('profileEdit.invalidName'), t('profileEdit.nameLength'));
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
        const result = await updateProfileName(user.id, profileName);
        if (!result.ok) {
          Alert.alert(t('common.error'), t('profileEdit.updateFailed'));
          setIsSaving(false);
          return;
        }

        // Update auth metadata
        await useAuthStore.getState().updateProfile({ profile_name: profileName });
      }

      Alert.alert(t('common.success'), t('profileEdit.updateSuccess'));
      navigation.goBack();
    } catch (error) {
      console.error('[ProfileEdit] Save error:', error);
      Alert.alert(t('common.error'), t('profileEdit.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(t('profileEdit.discardTitle'), t('profileEdit.discardMessage'), [
        { text: t('profileEdit.keepEditing'), style: 'cancel' },
        {
          text: t('profileEdit.discard'),
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const markChanged = () => setHasChanges(true);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{t('profileEdit.signInRequired')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profileEdit.title')}</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.headerButton, isSaving && styles.headerButtonDisabled]}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profileEdit.profileInfo')}</Text>
          <View style={styles.card}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <Text style={styles.emailText}>{user.email}</Text>

            <Text style={styles.label}>{t('register.profileName')}</Text>
            <TextInput
              style={styles.input}
              value={profileName}
              onChangeText={text => {
                setProfileName(text);
                markChanged();
              }}
              placeholder={t('profileEdit.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              maxLength={12}
              autoCapitalize="none"
            />
            <Text style={styles.hint}>{t('profileEdit.nameHint')}</Text>
          </View>
        </View>

        {/* Info about permanent filters */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t('profileEdit.dietPreferencesTitle')}</Text>
            <Text style={styles.infoText}>{t('profileEdit.dietPreferencesInfo')}</Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}
