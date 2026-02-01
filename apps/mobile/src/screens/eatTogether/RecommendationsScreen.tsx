import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import {
  getSessionRecommendations,
  castVote,
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
  const navigation = useNavigation();
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
      const { data, error } = await getSessionRecommendations(sessionId);

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
          const userVote = data.find((v: any) => v.user_id === user.id);
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
            navigation.navigate('VotingResults' as any, { sessionId });
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
      const { error } = await castVote(sessionId, user.id, restaurantId);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to cast vote');
        return;
      }

      setMyVote(restaurantId);
      await loadVoteResults();
    } catch (error) {
      console.error('[Recommendations] Error voting:', error);
      Alert.alert('Error', 'Failed to cast vote');
    } finally {
      setVoting(false);
    }
  }

  function getVoteCount(restaurantId: string): number {
    const result = voteResults.find((v: any) => v.restaurant_id === restaurantId);
    return result ? result.vote_count || 0 : 0;
  }

  function getVotePercentage(restaurantId: string): number {
    const result = voteResults.find((v: any) => v.restaurant_id === restaurantId);
    return result ? result.percentage || 0 : 0;
  }

  const totalVotes = voteResults.reduce((sum: number, v: any) => sum + (v.vote_count || 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Loading recommendations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (recommendations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>No recommendations found</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Go Back</Text>
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
          <Text style={styles.headerTitle}>Vote for Restaurant</Text>
          <Text style={styles.headerSubtitle}>{totalVotes} votes cast</Text>
        </View>
      </View>

      {/* Voting Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          🗳️{' '}
          {myVote
            ? 'You voted! You can change your vote.'
            : 'Tap to vote for your favorite restaurant'}
        </Text>
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
                    <Text style={styles.scoreLabel}>Match</Text>
                    <Text style={styles.scoreValue}>{rec.compatibility_score}/100</Text>
                  </View>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>Members</Text>
                    <Text style={styles.scoreValue}>
                      {rec.members_satisfied}/{rec.total_members}
                    </Text>
                  </View>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreLabel}>Distance</Text>
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
                      {voteCount} vote{voteCount !== 1 ? 's' : ''} ({votePercentage.toFixed(0)}%)
                    </Text>
                  </View>
                )}

                {isMyVote && (
                  <View style={styles.votedBadge}>
                    <Text style={styles.votedBadgeText}>✓ Your Vote</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#E0E0E0',
    fontSize: 24,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#E0E0E0',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  instructions: {
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  instructionsText: {
    color: '#E0E0E0',
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  restaurantCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  restaurantCardVoted: {
    borderColor: '#FF9800',
  },
  rankBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF9800',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  restaurantInfo: {
    paddingRight: 40,
  },
  restaurantName: {
    color: '#E0E0E0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  restaurantAddress: {
    color: '#999',
    fontSize: 14,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  scoreItem: {
    flex: 1,
  },
  scoreLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  scoreValue: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: '700',
  },
  voteBar: {
    height: 32,
    backgroundColor: '#333',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#4CAF50',
    opacity: 0.3,
  },
  voteBarFillMine: {
    backgroundColor: '#FF9800',
    opacity: 0.5,
  },
  voteBarText: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '600',
    zIndex: 1,
  },
  votedBadge: {
    marginTop: 8,
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  votedBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
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
  button: {
    backgroundColor: '#FF9800',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
