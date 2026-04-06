import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { styles } from './VotingResultsScreen.styles';
import { colors } from '@eatme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/types/navigation';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
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

  function openMaps(
    restaurant:
      | { name?: string; location?: { lat: number; lng: number }; address?: string }
      | undefined
  ) {
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
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>{t('votingResults.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session || voteResults.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{t('votingResults.noResults')}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('EatTogether')}
          >
            <Text style={styles.buttonText}>{t('votingResults.goToEatTogether')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const winner = voteResults[0]; // Results are sorted by vote count
  const totalVotes = voteResults.reduce((sum: number, v) => sum + (v.vote_count || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('votingResults.title')}</Text>
        <Text style={styles.headerSubtitle}>
          {t('votingResults.totalVotes', { count: totalVotes })}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Winner Card */}
        <View style={styles.winnerCard}>
          <View style={styles.crownBadge}>
            <Text style={styles.crownEmoji}>👑</Text>
          </View>
          <Text style={styles.winnerLabel}>{t('votingResults.winner')}</Text>
          <Text style={styles.winnerName}>{winner.restaurant?.name}</Text>
          <Text style={styles.winnerAddress}>{winner.restaurant?.address}</Text>

          <View style={styles.winnerStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{winner.vote_count}</Text>
              <Text style={styles.statLabel}>{t('votingResults.votes')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{winner.percentage?.toFixed(0)}%</Text>
              <Text style={styles.statLabel}>{t('votingResults.majority')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.navigationButton}
            onPress={() => openMaps(winner.restaurant)}
          >
            <Text style={styles.navigationButtonText}>{t('votingResults.openInMaps')}</Text>
          </TouchableOpacity>
        </View>

        {/* All Results */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('votingResults.allResults')}</Text>
          {voteResults.map((result, index) => (
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
          <Text style={styles.infoTitle}>{t('votingResults.enjoyMeal')}</Text>
          <Text style={styles.infoText}>{t('votingResults.sessionCloseInfo')}</Text>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('EatTogether')}>
          <Text style={styles.buttonText}>{t('votingResults.backToEatTogether')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
