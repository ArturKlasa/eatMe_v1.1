import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  getSessionDetails,
  getVoteResults,
  type EatTogetherSession,
  type VoteResult,
} from '../../services/eatTogetherService';

type VotingResultsScreenRouteParams = {
  VotingResults: {
    sessionId: string;
  };
};

/**
 * VotingResultsScreen - Shows voting results and winning restaurant
 */
export function VotingResultsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<VotingResultsScreenRouteParams, 'VotingResults'>>();
  const { sessionId } = route.params;

  const [session, setSession] = useState<EatTogetherSession | null>(null);
  const [voteResults, setVoteResults] = useState<VoteResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [sessionId]);

  async function loadResults() {
    try {
      const [sessionResult, votesResult] = await Promise.all([
        getSessionDetails(sessionId),
        getVoteResults(sessionId),
      ]);

      if (sessionResult.data) {
        setSession(sessionResult.data);
      }

      if (votesResult.data) {
        setVoteResults(votesResult.data);
      }
    } catch (error) {
      console.error('[VotingResults] Error loading:', error);
    } finally {
      setLoading(false);
    }
  }

  function openMaps(restaurant: any) {
    if (!restaurant) return;

    const lat = restaurant.location?.lat || 0;
    const lng = restaurant.location?.lng || 0;
    const label = encodeURIComponent(restaurant.name || 'Restaurant');

    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${label}`;
    Linking.openURL(url);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Loading results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session || voteResults.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>No voting results found</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('EatTogether' as any)}
          >
            <Text style={styles.buttonText}>Go to Eat Together</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const winner = voteResults[0]; // Results are sorted by vote count
  const totalVotes = voteResults.reduce((sum: number, v: any) => sum + (v.vote_count || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎉 Voting Results</Text>
        <Text style={styles.headerSubtitle}>{totalVotes} total votes</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Winner Card */}
        <View style={styles.winnerCard}>
          <View style={styles.crownBadge}>
            <Text style={styles.crownEmoji}>👑</Text>
          </View>
          <Text style={styles.winnerLabel}>Winner</Text>
          <Text style={styles.winnerName}>{winner.restaurant?.name}</Text>
          <Text style={styles.winnerAddress}>{winner.restaurant?.address}</Text>

          <View style={styles.winnerStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{winner.vote_count}</Text>
              <Text style={styles.statLabel}>Votes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{winner.percentage?.toFixed(0)}%</Text>
              <Text style={styles.statLabel}>Majority</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.navigationButton}
            onPress={() => openMaps(winner.restaurant)}
          >
            <Text style={styles.navigationButtonText}>📍 Open in Maps</Text>
          </TouchableOpacity>
        </View>

        {/* All Results */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Results</Text>
          {voteResults.map((result: any, index) => (
            <View key={result.restaurant_id} style={styles.resultCard}>
              <View style={styles.resultRank}>
                <Text style={styles.resultRankText}>#{index + 1}</Text>
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{result.restaurant?.name}</Text>
                <View style={styles.resultStats}>
                  <Text style={styles.resultVotes}>
                    {result.vote_count} vote{result.vote_count !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.resultPercentage}>({result.percentage?.toFixed(0)}%)</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Session Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>✨ Enjoy your meal together!</Text>
          <Text style={styles.infoText}>
            This session will close automatically in 3 hours, or the host can close it manually.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('EatTogether' as any)}
        >
          <Text style={styles.buttonText}>Back to Eat Together</Text>
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#E0E0E0',
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  winnerCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#FFD700',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  crownBadge: {
    position: 'absolute',
    top: -20,
    backgroundColor: '#FFD700',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  crownEmoji: {
    fontSize: 24,
  },
  winnerLabel: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  winnerName: {
    color: '#E0E0E0',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  winnerAddress: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  winnerStats: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  navigationButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  navigationButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 8,
  },
  resultRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultRankText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '700',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultVotes: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '600',
  },
  resultPercentage: {
    color: '#999',
    fontSize: 14,
  },
  infoBox: {
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoTitle: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
  },
  bottomActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  button: {
    backgroundColor: '#FF9800',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
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
