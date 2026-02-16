import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useUserLocation } from '../../hooks/useUserLocation';
import { createSession, updateMemberLocation } from '../../services/eatTogetherService';

/**
 * CreateSessionScreen - Host creates Eat Together session
 */
export function CreateSessionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const user = useAuthStore(state => state.user);
  const { location } = useUserLocation();

  const [loading, setLoading] = useState(false);
  const [locationMode, setLocationMode] = useState<'host_location' | 'midpoint' | 'max_radius'>(
    'host_location'
  );
  const [session, setSession] = useState<any>(null);
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    if (session && location) {
      // Update host location
      updateMemberLocation(session.id, user!.id, {
        lat: location.latitude,
        lng: location.longitude,
      });
    }
  }, [session, location]);

  const handleCreateSession = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('eatTogether.mustBeLoggedIn'));
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await createSession(user.id, locationMode);

      if (error || !data) {
        Alert.alert(t('common.error'), error?.message || t('eatTogether.createFailed'));
        return;
      }

      setSession(data);

      // Generate share link
      const link = `eatme://eat-together/join/${data.session_code}`;
      setShareLink(link);

      // Navigate to session lobby
      navigation.navigate('SessionLobby' as any, { sessionId: data.id });
    } catch (err) {
      Alert.alert(t('common.error'), t('common.somethingWrong'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!session) return;

    try {
      await Share.share({
        message: t('eatTogether.shareMessage', { code: session.session_code, link: shareLink }),
        title: t('eatTogether.shareTitle'),
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (session) {
    // Show session created success
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>{t('eatTogether.sessionCreated')}</Text>

          <View style={styles.codeSection}>
            <Text style={styles.label}>{t('eatTogether.sessionCode')}</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{session.session_code}</Text>
            </View>
            <Text style={styles.hint}>{t('eatTogether.shareCode')}</Text>
          </View>

          <View style={styles.qrSection}>
            <Text style={styles.label}>{t('eatTogether.qrCode')}</Text>
            <View style={styles.qrBox}>
              <QRCode value={shareLink} size={200} backgroundColor="#FFF" />
            </View>
            <Text style={styles.hint}>{t('eatTogether.qrCodeDescription')}</Text>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>{t('eatTogether.shareLink')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => navigation.navigate('SessionLobby' as any, { sessionId: session.id })}
          >
            <Text style={styles.continueButtonText}>{t('eatTogether.goToLobby')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('eatTogether.createSessionTitle')}</Text>
        <Text style={styles.subtitle}>{t('eatTogether.createSessionSubtitle')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('eatTogether.locationMode')}</Text>
          <Text style={styles.sectionHint}>{t('eatTogether.locationModeDescription')}</Text>

          <TouchableOpacity
            style={[
              styles.optionCard,
              locationMode === 'host_location' && styles.optionCardSelected,
            ]}
            onPress={() => setLocationMode('host_location')}
          >
            <View style={styles.radio}>
              {locationMode === 'host_location' && <View style={styles.radioSelected} />}
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>{t('eatTogether.myLocation')}</Text>
              <Text style={styles.optionDescription}>{t('eatTogether.myLocationDescription')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, locationMode === 'midpoint' && styles.optionCardSelected]}
            onPress={() => setLocationMode('midpoint')}
          >
            <View style={styles.radio}>
              {locationMode === 'midpoint' && <View style={styles.radioSelected} />}
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>{t('eatTogether.midpoint')}</Text>
              <Text style={styles.optionDescription}>{t('eatTogether.midpointDescription')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, locationMode === 'max_radius' && styles.optionCardSelected]}
            onPress={() => setLocationMode('max_radius')}
          >
            <View style={styles.radio}>
              {locationMode === 'max_radius' && <View style={styles.radioSelected} />}
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>{t('eatTogether.maxReach')}</Text>
              <Text style={styles.optionDescription}>{t('eatTogether.maxReachDescription')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreateSession}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.createButtonText}>{t('eatTogether.createSession')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E0E0E0',
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: '#FF9800',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF9800',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E0E0E0',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#999',
  },
  createButton: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  codeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B0B0B0',
    marginBottom: 12,
  },
  codeBox: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 40,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF9800',
    letterSpacing: 4,
  },
  hint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  qrBox: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 8,
  },
  shareButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  shareButtonText: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
