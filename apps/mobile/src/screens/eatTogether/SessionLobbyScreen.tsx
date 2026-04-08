import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { styles } from './SessionLobbyScreen.styles';
import { colors } from '@eatme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/types/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import {
  getSessionDetails,
  getSessionMembers,
  leaveSession,
  updateMemberLocation,
  invokeGroupRecommendations,
  type EatTogetherSession,
  type SessionMember,
} from '../../services/eatTogetherService';
import { useUserLocation } from '../../hooks/useUserLocation';
import { supabase } from '../../lib/supabase';

type SessionLobbyScreenRouteParams = {
  SessionLobby: {
    sessionId: string;
    isHost: boolean;
  };
};

function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * SessionLobbyScreen - Waiting room for Eat Together sessions
 * Shows live member list, allows host to trigger recommendations
 */
export function SessionLobbyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<SessionLobbyScreenRouteParams, 'SessionLobby'>>();
  const { sessionId, isHost } = route.params;
  const user = useAuthStore(state => state.user);
  const { location } = useUserLocation();

  const [session, setSession] = useState<EatTogetherSession | null>(null);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [locationMode, setLocationMode] = useState<'host_location' | 'midpoint' | 'max_radius'>(
    'host_location'
  );

  useEffect(() => {
    loadSessionData();
    return setupRealtimeSubscription();
  }, [sessionId]);

  // Update user location when it changes
  useEffect(() => {
    if (user && location) {
      updateMemberLocation(sessionId, user.id, { lat: location.latitude, lng: location.longitude });
    }
  }, [location]);

  // Expiry countdown timer
  useEffect(() => {
    if (!session?.expires_at) return;

    const interval = setInterval(() => {
      const remaining = new Date(session.expires_at!).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeRemaining(0);
        clearInterval(interval);
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    // Initialize immediately
    const initial = new Date(session.expires_at).getTime() - Date.now();
    setTimeRemaining(initial > 0 ? initial : 0);

    return () => clearInterval(interval);
  }, [session?.expires_at]);

  async function loadSessionData() {
    try {
      const [sessionResult, membersResult] = await Promise.all([
        getSessionDetails(sessionId),
        getSessionMembers(sessionId),
      ]);

      if (sessionResult.data) {
        setSession(sessionResult.data);
      }

      if (membersResult.data) {
        setMembers(membersResult.data);
      }
    } catch (error) {
      console.error('[SessionLobby] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function setupRealtimeSubscription() {
    // Subscribe to members table changes
    const channel = supabase
      .channel(`session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'eat_together_members',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadSessionData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'eat_together_sessions',
          filter: `id=eq.${sessionId}`,
        },
        payload => {
          if (payload.new.status === 'voting') {
            // Navigate to recommendations screen
            navigation.navigate('Recommendations', { sessionId, isHost });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  async function handleGenerateRecommendations() {
    if (!isHost) return;

    const activeMembers = members.filter(m => !m.left_at);
    if (activeMembers.length < 2) {
      Alert.alert(t('sessionLobby.notEnoughMembers'), t('sessionLobby.needTwoMembers'));
      return;
    }

    const membersWithLoc = activeMembers.filter(m => m.current_location);
    if (membersWithLoc.length < activeMembers.length) {
      Alert.alert(t('common.error'), t('sessionLobby.locationRequired'));
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await invokeGroupRecommendations(sessionId, locationMode);

      if (error) {
        Alert.alert(t('sessionLobby.recommendationFailed'), error.message);
        return;
      }

      if (data && data.recommendations.length === 0) {
        Alert.alert(
          t('sessionLobby.noRestaurants'),
          data.conflicts?.join('\n') || t('sessionLobby.noRestaurantsMessage')
        );
      }
      // Session status auto-transitions to 'voting' via edge function
      // Realtime subscription handles navigation
    } catch (error) {
      console.error('[SessionLobby] Error generating recommendations:', error);
      Alert.alert(t('sessionLobby.recommendationFailed'), t('common.somethingWrong'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleLeaveSession() {
    if (!user) return;

    Alert.alert(
      isHost ? t('sessionLobby.closeTitle') : t('sessionLobby.leaveTitle'),
      isHost ? t('sessionLobby.closeMessage') : t('sessionLobby.leaveMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isHost ? t('sessionLobby.close') : t('sessionLobby.leave'),
          style: 'destructive',
          onPress: async () => {
            await leaveSession(sessionId, user.id);
            navigation.goBack();
          },
        },
      ]
    );
  }

  const isExpired = timeRemaining !== null && timeRemaining === 0;
  const isWarning = timeRemaining !== null && timeRemaining > 0 && timeRemaining < 10 * 60 * 1000;
  const activeMembers = members.filter(m => !m.left_at);
  const membersWithLocation = activeMembers.filter(m => m.current_location);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>{t('sessionLobby.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{t('sessionLobby.notFound')}</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>{t('common.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('sessionLobby.title')}</Text>
          <Text style={styles.sessionCode}>
            {t('sessionLobby.code', { code: session.session_code })}
          </Text>
          {timeRemaining !== null && (
            <Text style={[styles.expiryTimer, isWarning && styles.expiryTimerWarning]}>
              {formatTimeRemaining(timeRemaining)}
            </Text>
          )}
        </View>
        {isHost && (
          <TouchableOpacity onPress={handleLeaveSession} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('sessionLobby.close')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('sessionLobby.membersCount', {
              count: activeMembers.length,
              withLocation: membersWithLocation.length,
            })}
          </Text>
          <View style={styles.membersList}>
            {activeMembers.map(member => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.profile_name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {member.profile_name}
                    {member.is_host && ` ${t('sessionLobby.host')}`}
                  </Text>
                  <Text style={styles.memberStatus}>
                    {member.current_location
                      ? t('sessionLobby.locationShared')
                      : t('sessionLobby.waitingLocation')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Location Mode (Host Only) */}
        {isHost && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sessionLobby.locationCalculation')}</Text>
            <View style={styles.locationModes}>
              {[
                {
                  key: 'host_location',
                  label: t('eatTogether.myLocation'),
                  desc: t('sessionLobby.hostLocation'),
                },
                {
                  key: 'midpoint',
                  label: t('eatTogether.midpoint'),
                  desc: t('sessionLobby.midpoint'),
                },
                {
                  key: 'max_radius',
                  label: t('eatTogether.maxReach'),
                  desc: t('sessionLobby.maxRadius', { radius: 5 }),
                },
              ].map(mode => (
                <TouchableOpacity
                  key={mode.key}
                  style={[
                    styles.locationModeOption,
                    locationMode === mode.key && styles.locationModeOptionSelected,
                  ]}
                  onPress={() =>
                    setLocationMode(mode.key as 'host_location' | 'midpoint' | 'max_radius')
                  }
                >
                  <View style={styles.radio}>
                    {locationMode === mode.key && <View style={styles.radioSelected} />}
                  </View>
                  <View style={styles.locationModeText}>
                    <Text style={styles.locationModeLabel}>{mode.label}</Text>
                    <Text style={styles.locationModeDesc}>{mode.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {isHost ? t('sessionLobby.hostInfo') : t('sessionLobby.waitingForMembers')}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {!isHost && (
          <TouchableOpacity
            style={[styles.button, styles.leaveButton]}
            onPress={handleLeaveSession}
          >
            <Text style={styles.buttonText}>{t('sessionLobby.leave')}</Text>
          </TouchableOpacity>
        )}

        {isHost && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              (generating || activeMembers.length < 2 || isExpired) && styles.buttonDisabled,
            ]}
            onPress={handleGenerateRecommendations}
            disabled={generating || activeMembers.length < 2 || isExpired}
          >
            {generating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>{t('sessionLobby.generateRecommendations')}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Generating Overlay */}
      {generating && !isExpired && (
        <View style={styles.expiredOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.expiredOverlayTitle}>{t('sessionLobby.generating')}</Text>
        </View>
      )}

      {/* Expired Overlay */}
      {isExpired && (
        <View style={styles.expiredOverlay}>
          <Text style={styles.expiredOverlayTitle}>{t('sessionLobby.sessionExpired')}</Text>
          <Text style={styles.expiredOverlayText}>{t('sessionLobby.sessionExpiredMessage')}</Text>
          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>{t('common.goBack')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
