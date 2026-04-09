/**
 * InContextRating
 *
 * Inline dish rating component shown on each dish card in RestaurantDetailScreen.
 * Lets users rate a dish in under 5 seconds without leaving the screen.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
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

const OPINION_LABELS: Record<DishOpinion, string> = {
  liked: 'rating.rateDish.lovedIt',
  okay: 'rating.rateDish.okay',
  disliked: 'rating.rateDish.notForMe',
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
  const { t } = useTranslation();

  const [uiState, setUiState] = useState<State>('selecting');
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
      Alert.alert(t('common.error'), t('common.ratingError'));
    }
  };

  if (uiState === 'done') {
    return (
      <View style={styles.opinionContainer}>
        <Animated.Text style={[styles.checkmark, { opacity: checkmarkOpacity }]}>✓</Animated.Text>
      </View>
    );
  }

  if (uiState === 'tagging' && pendingOpinion) {
    return (
      <View style={styles.tagsSection}>
        <Text style={styles.tagsTitle}>
          {pendingOpinion === 'liked'
            ? t('rating.rateDish.whatMadeItGreat')
            : t('rating.rateDish.whatCouldBeBetter')}
        </Text>
        <View style={styles.tagsContainer}>
          {availableTags.map(tag => (
            <TouchableOpacity
              key={tag}
              style={styles.tagButton}
              onPress={() => handleTagsConfirm([tag])}
              disabled={submitting}
            >
              <Text style={styles.tagText}>{DISH_TAG_LABELS[tag]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => handleTagsConfirm([])} disabled={submitting}>
          <Text style={styles.skipLink}>{t('common.skip', { defaultValue: 'Skip' })}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.opinionContainer}>
      {(['liked', 'okay', 'disliked'] as DishOpinion[]).map(op => (
        <TouchableOpacity
          key={op}
          style={[
            styles.opinionButton,
            op === 'liked' && currentOpinion === 'liked' && styles.opinionButtonLiked,
            op === 'okay' && currentOpinion === 'okay' && styles.opinionButtonOkay,
            op === 'disliked' && currentOpinion === 'disliked' && styles.opinionButtonDisliked,
          ]}
          onPress={() => {
            setUiState('selecting');
            handleOpinionSelect(op);
          }}
          disabled={submitting}
        >
          <Text style={styles.opinionEmoji}>{OPINION_ICONS[op]}</Text>
          <Text style={[styles.opinionText, currentOpinion === op && styles.opinionTextSelected]}>
            {t(OPINION_LABELS[op])}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  opinionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  opinionButton: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.darkSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  opinionButtonLiked: {
    borderColor: colors.success,
    backgroundColor: `${colors.success}20`,
  },
  opinionButtonOkay: {
    borderColor: colors.warning,
    backgroundColor: `${colors.warning}20`,
  },
  opinionButtonDisliked: {
    borderColor: colors.error,
    backgroundColor: `${colors.error}20`,
  },
  opinionEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  opinionText: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
  },
  opinionTextSelected: {
    color: colors.white,
    fontWeight: typography.weight.medium,
  },
  tagsSection: {
    marginBottom: spacing.xl,
  },
  tagsTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tagButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.darkSecondary,
    borderWidth: 1,
    borderColor: colors.darkBorderLight,
  },
  tagText: {
    fontSize: typography.size.sm,
    color: colors.darkText,
  },
  skipLink: {
    color: colors.darkTextSecondary,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  checkmark: {
    color: colors.success,
    fontSize: 18,
    fontWeight: typography.weight.bold,
  },
});
