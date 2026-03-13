import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { styles } from './JoinSessionScreen.styles';
import { colors } from '@eatme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useUserLocation } from '../../hooks/useUserLocation';
import { joinSession } from '../../services/eatTogetherService';

/**
 * JoinSessionScreen - Join existing session by code
 */
export function JoinSessionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const user = useAuthStore(state => state.user);
  const { location } = useUserLocation();

  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('sessionJoin.mustBeLoggedIn'));
      return;
    }

    if (sessionCode.length !== 6) {
      Alert.alert(t('sessionJoin.invalidCode'), t('sessionJoin.codeLength'));
      return;
    }

    setLoading(true);

    try {
      const userLocation = location
        ? { lat: location.latitude, lng: location.longitude }
        : undefined;

      const { data, error } = await joinSession(user.id, sessionCode, userLocation);

      if (error || !data) {
        Alert.alert(t('common.error'), error?.message || t('sessionJoin.joinFailed'));
        return;
      }

      // Navigate to session lobby
      navigation.navigate('SessionLobby' as any, { sessionId: data.id });
    } catch (err) {
      Alert.alert(t('common.error'), t('common.somethingWrong'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string) => {
    // Allow only alphanumeric, max 6 chars, uppercase
    const cleaned = text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    setSessionCode(cleaned);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('sessionJoin.title')}</Text>
        <Text style={styles.subtitle}>{t('sessionJoin.subtitle')}</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('sessionJoin.sessionCode')}</Text>
          <TextInput
            style={styles.input}
            value={sessionCode}
            onChangeText={handleCodeChange}
            placeholder={t('sessionJoin.codePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
          />
          <Text style={styles.hint}>{t('sessionJoin.codeHint')}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.joinButton,
            (loading || sessionCode.length !== 6) && styles.joinButtonDisabled,
          ]}
          onPress={handleJoin}
          disabled={loading || sessionCode.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.joinButtonText}>{t('sessionJoin.joinButton')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={() =>
            Alert.alert(t('sessionJoin.qrScanner'), t('sessionJoin.qrScannerComingSoon'))
          }
        >
          <Text style={styles.scanButtonText}>{t('sessionJoin.scanQR')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
