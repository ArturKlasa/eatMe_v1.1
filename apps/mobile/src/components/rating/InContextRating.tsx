/**
 * InContextRating
 *
 * Inline dish rating component shown on each dish card in RestaurantDetailScreen.
 * Lets users rate a dish in under 5 seconds without leaving the screen.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { colors, spacing, typography } from '../../styles/theme';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { submitInContextRating } from '../../services/ratingService';
import {
  DishOpinion,
  DishTag,
  POSITIVE_DISH_TAGS,
  NEGATIVE_DISH_TAGS,
  DISH_TAG_LABELS,
} from '../../types/rating';

interface InContextRatingProps {
  dishId: string;
  dishName: string;
  restaurantId: string;
  existingOpinion: DishOpinion | null;
  onRated: (opinion: DishOpinion, tags: DishTag[]) => void;
}

type State = 'idle' | 'selecting' | 'tagging' | 'done';

const OPINION_ICONS: Record<DishOpinion, string> = {
  liked: '👍',
  okay: '😐',
  disliked: '👎',
};

export function InContextRating({
  dishId,
  dishName,
  restaurantId,
  existingOpinion,
  onRated,
}: InContextRatingProps) {
  const user = useAuthStore(state => state.user);
  const currentSessionId = useSessionStore(state => state.currentSessionId);

  const [uiState, setUiState] = useState<State>('idle');
  const [pendingOpinion, setPendingOpinion] = useState<DishOpinion | null>(null);
  const [currentOpinion, setCurrentOpinion] = useState<DishOpinion | null>(existingOpinion);
  const [submitting, setSubmitting] = useState(false);

  const checkmarkOpacity = useRef(new Animated.Value(0)).current;

  // Sync external existingOpinion changes (e.g. screen reload)
  useEffect(() => {
    setCurrentOpinion(existingOpinion);
  }, [existingOpinion]);

  if (!user) return null;

  const availableTags =
    pendingOpinion === 'liked'
      ? POSITIVE_DISH_TAGS
      : pendingOpinion === 'disliked'
        ? NEGATIVE_DISH_TAGS
        : [];

  const handleOpinionSelect = (opinion: DishOpinion) => {
    if (opinion === 'okay') {
      // No tagging step for okay — submit immediately
      handleSubmit(opinion, []);
    } else {
      setPendingOpinion(opinion);
      setUiState('tagging');
    }
  };

  const handleTagsConfirm = (tags: DishTag[]) => {
    if (pendingOpinion) {
      handleSubmit(pendingOpinion, tags);
    }
  };

  const handleSubmit = async (opinion: DishOpinion, tags: DishTag[]) => {
    setSubmitting(true);
    // Optimistic update
    setCurrentOpinion(opinion);
    setUiState('done');
    onRated(opinion, tags);

    // Animate checkmark in
    Animated.sequence([
      Animated.timing(checkmarkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(checkmarkOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setUiState('idle');
      setPendingOpinion(null);
      setSubmitting(false);
    });

    const result = await submitInContextRating(
      user.id,
      restaurantId,
      dishId,
      dishName,
      opinion,
      tags,
      currentSessionId
    );

    if (!result.success) {
      // Revert on error
      setCurrentOpinion(existingOpinion);
      setUiState('idle');
      setPendingOpinion(null);
      setSubmitting(false);
      Alert.alert('Error', 'Failed to save your rating. Please try again.');
    }
  };

  if (uiState === 'done') {
    return (
      <View style={styles.row}>
        <Animated.Text style={[styles.checkmark, { opacity: checkmarkOpacity }]}>✓</Animated.Text>
      </View>
    );
  }

  if (uiState === 'tagging' && pendingOpinion) {
    return (
      <View style={styles.taggingContainer}>
        <View style={styles.tagRow}>
          {availableTags.map(tag => (
            <TouchableOpacity
              key={tag}
              style={styles.tagChip}
              onPress={() => handleTagsConfirm([tag])}
              disabled={submitting}
            >
              <Text style={styles.tagChipText}>{DISH_TAG_LABELS[tag]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => handleTagsConfirm([])} disabled={submitting}>
          <Text style={styles.skipLink}>Skip</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (uiState === 'selecting' || currentOpinion !== null) {
    return (
      <View style={styles.row}>
        {(['liked', 'okay', 'disliked'] as DishOpinion[]).map(opinion => (
          <TouchableOpacity
            key={opinion}
            style={[
              styles.opinionButton,
              currentOpinion === opinion && styles.opinionButtonActive,
            ]}
            onPress={() => {
              setUiState('selecting');
              handleOpinionSelect(opinion);
            }}
            disabled={submitting}
          >
            <Text style={styles.opinionIcon}>{OPINION_ICONS[opinion]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // Idle — no existing opinion
  return (
    <TouchableOpacity onPress={() => setUiState('selecting')} style={styles.triedItButton}>
      <Text style={styles.triedItText}>Tried it?</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  triedItButton: {
    marginTop: spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  triedItText: {
    color: colors.accent,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  opinionButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border ?? '#333',
  },
  opinionButtonActive: {
    backgroundColor: colors.accent + '33',
    borderColor: colors.accent,
  },
  opinionIcon: {
    fontSize: 16,
  },
  taggingContainer: {
    marginTop: spacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent + '22',
  },
  tagChipText: {
    color: colors.accent,
    fontSize: typography.size.xs,
  },
  skipLink: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
  },
  checkmark: {
    color: colors.success,
    fontSize: 18,
    fontWeight: typography.weight.bold,
  },
});
