import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
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
            placeholderTextColor="#666"
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
            <ActivityIndicator color="#FFF" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 40,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 20,
    fontSize: 24,
    color: '#E0E0E0',
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '600',
    borderWidth: 2,
    borderColor: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  scanButtonText: {
    color: '#E0E0E0',
    fontSize: 16,
  },
  backButton: {
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#999',
    fontSize: 16,
  },
});
