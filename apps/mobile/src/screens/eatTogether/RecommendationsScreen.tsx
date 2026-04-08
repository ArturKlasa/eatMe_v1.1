import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { styles } from './RecommendationsScreen.styles';
import { colors } from '@eatme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/types/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import {
  getRecommendations,
  submitVote,
  getVoteResults,
  finalizeSelection,
  type SessionRecommendation,
  type VoteResult,
} from '../../services/eatTogetherService';
import { supabase } from '../../lib/supabase';

type RecommendationsScreenRouteParams = {
  Recommendations: {
    sessionId: string;
    isHost: boolean;
  };
};

/**
 * RecommendationsScreen - Shows top 5 restaurant recommendations
 * Members vote for their preferred restaurant
 */
export function RecommendationsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RecommendationsScreenRouteParams, 'Recommendations'>>();
  const { sessionId, isHost } = route.params;
  const user = useAuthStore(state => state.user);

  const [recommendations, setRecommendations] = useState<SessionRecommendation[]>([]);
  const [voteResults, setVoteResults] = useState<VoteResult[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    loadRecommendations();
    loadVoteResults();
    loadMyVote();
    return setupRealtimeSubscription();
  }, [sessionId]);

  async function loadRecommendations() {
    try {
      const { data, error } = await getRecommendations(sessionId);

      if (error) {
        console.error('[Recommendations] Error loading:', error);
        return;
      }

      if (data) {
        setRecommendations(data);
      }
    } catch (error) {
      console.error('[Recommendations] Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadVoteResults() {
    try {
      const { data } = await getVoteResults(sessionId);
      if (data) {
        setVoteResults(data);
      }
    } catch (error) {
      console.error('[Recommendations] Error loading votes:', error);
    }
  }

  async function loadMyVote() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('eat_together_votes')
        .select('restaurant_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setMyVote(data.restaurant_id);
      }
    } catch (error) {
      console.error('[Recommendations] Error loading user vote:', error);
    }
  }

  function setupRealtimeSubscription() {
    // Subscribe to votes table changes
    const channel = supabase
      .channel(`votes_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'eat_together_votes',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadVoteResults();
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
          if (payload.new.status === 'decided' && payload.new.selected_restaurant_id) {
            // Navigate to results screen only when a restaurant was actually selected
            navigation.navigate('VotingResults', { sessionId });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  async function handleVote(restaurantId: string) {
    if (!user || voting) return;

    setVoting(true);
    try {
      const { error } = await submitVote(sessionId, user.id, restaurantId);

      if (error) {
        Alert.alert(t('common.error'), error.message || t('sessionVoting.voteFailed'));
        return;
      }

      setMyVote(restaurantId);
      await loadVoteResults();
    } catch (error) {
      console.error('[Recommendations] Error voting:', error);
      Alert.alert(t('common.error'), t('sessionVoting.voteFailed'));
    } finally {
      setVoting(false);
    }
  }

  async function handleFinalize() {
    if (finalizing) return;
    const topResult = voteResults.reduce<VoteResult | null>(
      (best, v) => (!best || (v.vote_count ?? 0) > (best.vote_count ?? 0) ? v : best),
      null
    );
    const topRestaurantId = topResult?.restaurant_id ?? recommendations[0]?.restaurant_id;
    if (!topRestaurantId) {
      Alert.alert(t('common.error'), t('sessionVoting.noVotesToFinalize'));
      return;
    }
    setFinalizing(true);
    try {
      const { error } = await finalizeSelection(sessionId, topRestaurantId);
      if (error) {
        Alert.alert(t('common.error'), error.message || t('sessionVoting.finalizeFailed'));
      }
    } catch (err) {
      console.error('[Recommendations] Error finalizing:', err);
      Alert.alert(t('common.error'), t('sessionVoting.finalizeFailed'));
    } finally {
      setFinalizing(false);
    }
  }

  function getVoteCount(restaurantId: string): number {
    const result = voteResults.find(v => v.restaurant_id === restaurantId);
    return result ? result.vote_count || 0 : 0;
  }

  function getVotePercentage(restaurantId: string): number {
    if (totalVotes === 0) return 0;
    const result = voteResults.find(v => v.restaurant_id === restaurantId);
    return result ? Math.round((result.vote_count / totalVotes) * 100) : 0;
  }

  const totalVotes = voteResults.reduce((sum: number, v) => sum + (v.vote_count || 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>{t('sessionVoting.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (recommendations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{t('sessionVoting.noRecommendations')}</Text>
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
          <Text style={styles.headerTitle}>{t('sessionVoting.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('sessionVoting.votesCast', { count: totalVotes })}
          </Text>
        </View>
      </View>

      {/* Voting Instructions */}
      <View style={styles.instructions}>
        {voting ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.instructionsText}>{t('sessionVoting.submittingVote')}</Text>
          </View>
        ) : (
          <Text style={styles.instructionsText}>{t('sessionVoting.instructions')}</Text>
        )}
      </View>

      {isHost && (
        <View style={styles.finalizeContainer}>
          <TouchableOpacity
            style={[styles.button, finalizing && styles.buttonDisabled]}
            onPress={handleFinalize}
            disabled={finalizing}
          >
            {finalizing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('sessionVoting.finalizeResults')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content}>
        {recommendations.map((rec, index) => {
          const voteCount = getVoteCount(rec.restaurant_id);
          const votePercentage = getVotePercentage(rec.restaurant_id);
          const isMyVote = myVote === rec.restaurant_id;

          return (
            <TouchableOpacity
              key={rec.id}
              style={[styles.restaurantCard, isMyVote && styles.restaurantCardVoted]}
              onPress={() => handleVote(rec.restaurant_id)}
              disabled={voting}
            >
              {/* Rank Badge */}
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>

              {/* Restaurant Info */}
              <View style={styles.restaurantInfo}>
                <Text style={styles.restaurantName}>{rec.restaurant?.name}</Text>
                <Text style={styles.restaurantAddress}>{rec.restaurant?.address}</Text>

                {/* Compatibility Score */}
                <View style={styles.scoreRow}>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>{t('sessionVoting.match')}</Text>
                    <Text style={styles.scoreValue}>
                      {Math.round(rec.compatibility_score ?? 0)}/100
                    </Text>
                  </View>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>{t('sessionVoting.members')}</Text>
                    <Text style={styles.scoreValue}>
                      {rec.members_satisfied}/{rec.total_members}
                    </Text>
                  </View>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>{t('sessionVoting.distance')}</Text>
                    <Text style={styles.scoreValue}>{rec.distance_from_center?.toFixed(1)}km</Text>
                  </View>
                </View>

                {/* Vote Bar */}
                {totalVotes > 0 && (
                  <View style={styles.voteBar}>
                    <View
                      style={[
                        styles.voteBarFill,
                        { width: `${votePercentage}%` },
                        isMyVote && styles.voteBarFillMine,
                      ]}
                    />
                    <Text style={styles.voteBarText}>
                      {t('sessionVoting.votes', {
                        count: voteCount,
                        percentage: votePercentage.toFixed(0),
                      })}
                    </Text>
                  </View>
                )}

                {isMyVote && (
                  <View style={styles.votedBadge}>
                    <Text style={styles.votedBadgeText}>{t('sessionVoting.yourVote')}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
