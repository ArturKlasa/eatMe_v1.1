import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import {
  getSessionDetails,
  getSessionMembers,
  leaveSession,
  updateMemberLocation,
  generateRecommendations,
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

/**
 * SessionLobbyScreen - Waiting room for Eat Together sessions
 * Shows live member list, allows host to trigger recommendations
 */
export function SessionLobbyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<SessionLobbyScreenRouteParams, 'SessionLobby'>>();
  const { sessionId, isHost } = route.params;
  const user = useAuthStore(state => state.user);
  const { location } = useUserLocation();

  const [session, setSession] = useState<EatTogetherSession | null>(null);
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [locationMode, setLocationMode] = useState<'host_location' | 'midpoint' | 'max_radius'>(
    'host_location'
  );

  useEffect(() => {
    loadSessionData();
    setupRealtimeSubscription();
  }, [sessionId]);

  // Update user location when it changes
  useEffect(() => {
    if (user && location) {
      updateMemberLocation(sessionId, user.id, location.latitude, location.longitude);
    }
  }, [location]);

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
            navigation.navigate('Recommendations' as any, { sessionId });
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

    setGenerating(true);
    try {
      const { data, error } = await generateRecommendations(sessionId, locationMode, 5);

      if (error) {
        Alert.alert(t('common.error'), error.message || t('common.somethingWrong'));
        return;
      }

      if (data && data.recommendations.length > 0) {
        navigation.navigate('Recommendations' as any, { sessionId });
      } else {
        Alert.alert(
          t('sessionLobby.noRestaurants'),
          t('sessionLobby.noRestaurantsMessage')
        );
      }
    } catch (error) {
      console.error('[SessionLobby] Error generating recommendations:', error);
      Alert.alert(t('common.error'), t('common.somethingWrong'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleLeaveSession() {
    if (!user) return;

    Alert.alert(
      isHost ? t('sessionLobby.closeTitle') : t('sessionLobby.leaveTitle'),
      isHost
        ? t('sessionLobby.closeMessage')
        : t('sessionLobby.leaveMessage'),
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

  const activeMembers = members.filter(m => !m.left_at);
  const membersWithLocation = activeMembers.filter(m => m.current_location);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF9800" />
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
          <Text style={styles.sessionCode}>{t('sessionLobby.code', { code: session.session_code })}</Text>
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
            {t('sessionLobby.membersCount', { count: activeMembers.length, withLocation: membersWithLocation.length })}
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
                    {member.current_location ? t('sessionLobby.locationShared') : t('sessionLobby.waitingLocation')}
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
                { key: 'host_location', label: t('eatTogether.myLocation'), desc: t('sessionLobby.hostLocation') },
                { key: 'midpoint', label: t('eatTogether.midpoint'), desc: t('sessionLobby.midpoint') },
                { key: 'max_radius', label: t('eatTogether.maxReach'), desc: t('sessionLobby.maxRadius', { radius: 5 }) },
              ].map(mode => (
                <TouchableOpacity
                  key={mode.key}
                  style={[
                    styles.locationModeOption,
                    locationMode === mode.key && styles.locationModeOptionSelected,
                  ]}
                  onPress={() => setLocationMode(mode.key as any)}
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
            {isHost
              ? t('sessionLobby.hostInfo')
              : t('sessionLobby.waitingForMembers')}
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
              (generating || activeMembers.length < 2) && styles.buttonDisabled,
            ]}
            onPress={handleGenerateRecommendations}
            disabled={generating || activeMembers.length < 2}
          >
            {generating ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>
                {t('sessionLobby.generateRecommendations')}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
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
  backButton: {
    padding: 8,
    width: 60,
  },
  backButtonText: {
    color: '#E0E0E0',
    fontSize: 24,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#E0E0E0',
    fontSize: 18,
    fontWeight: '600',
  },
  sessionCode: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    width: 60,
    alignItems: 'flex-end',
  },
  closeButtonText: {
    color: '#FF5722',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
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
  membersList: {
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
  },
  memberStatus: {
    color: '#999',
    fontSize: 13,
    marginTop: 2,
  },
  locationModes: {
    gap: 12,
  },
  locationModeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
  },
  locationModeOptionSelected: {
    borderColor: '#FF9800',
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
  locationModeText: {
    flex: 1,
  },
  locationModeLabel: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
  },
  locationModeDesc: {
    color: '#999',
    fontSize: 13,
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF9800',
    marginTop: 8,
  },
  infoText: {
    color: '#E0E0E0',
    fontSize: 14,
    lineHeight: 20,
  },
  bottomActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  button: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#FF9800',
  },
  leaveButton: {
    backgroundColor: '#FF5722',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: '#FF5722',
    fontSize: 16,
    marginBottom: 16,
  },
});
