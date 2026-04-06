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
  type SessionRecommendation,
  type VoteResult,
} from '../../services/eatTogetherService';
import { supabase } from '../../lib/supabase';

type RecommendationsScreenRouteParams = {
  Recommendations: {
    sessionId: string;
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
  const { sessionId } = route.params;
  const user = useAuthStore(state => state.user);

  const [recommendations, setRecommendations] = useState<SessionRecommendation[]>([]);
  const [voteResults, setVoteResults] = useState<VoteResult[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    loadRecommendations();
    loadVoteResults();
    setupRealtimeSubscription();
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

        // Check if user has voted
        if (user) {
          const userVote = data.find(v => (v.user_id as string) === user.id);
          if (userVote) {
            setMyVote(userVote.restaurant_id);
          }
        }
      }
    } catch (error) {
      console.error('[Recommendations] Error loading votes:', error);
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
          if (payload.new.status === 'decided') {
            // Navigate to results screen
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

  function getVoteCount(restaurantId: string): number {
    const result = voteResults.find(v => v.restaurant_id === restaurantId);
    return result ? result.vote_count || 0 : 0;
  }

  function getVotePercentage(restaurantId: string): number {
    const result = voteResults.find(v => v.restaurant_id === restaurantId);
    return result ? Number(result.percentage) || 0 : 0;
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
        <Text style={styles.instructionsText}>{t('sessionVoting.instructions')}</Text>
      </View>

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
