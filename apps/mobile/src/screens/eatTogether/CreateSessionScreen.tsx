import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  ScrollView,
} from 'react-native';
import { styles } from './CreateSessionScreen.styles';
import { colors } from '@eatme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/types/navigation';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useUserLocation } from '../../hooks/useUserLocation';
import {
  createSession,
  updateMemberLocation,
  type EatTogetherSession,
} from '../../services/eatTogetherService';

/**
 * CreateSessionScreen - Host creates Eat Together session
 */
export function CreateSessionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const user = useAuthStore(state => state.user);
  const { location } = useUserLocation();

  const [loading, setLoading] = useState(false);
  const [locationMode, setLocationMode] = useState<'host_location' | 'midpoint' | 'max_radius'>(
    'host_location'
  );
  const [session, setSession] = useState<EatTogetherSession | null>(null);
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    if (session && location && user) {
      // Update host location
      updateMemberLocation(session.id, user.id, {
        lat: location.latitude,
        lng: location.longitude,
      }).catch(err => {
        console.error('Failed to update host location:', err);
      });
    }
  }, [session, location, user]);

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
      navigation.navigate('SessionLobby', { sessionId: data.id, isHost: true });
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
            onPress={() => navigation.navigate('SessionLobby', { sessionId: session!.id, isHost: true })}
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
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.createButtonText}>{t('eatTogether.createSession')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
