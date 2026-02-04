/**
 * Rate Dish Screen
 *
 * Third step of the rating flow - user rates each selected dish.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import {
  DishOpinion,
  DishTag,
  DishRatingInput,
  POSITIVE_DISH_TAGS,
  NEGATIVE_DISH_TAGS,
  DISH_TAG_LABELS,
  RecentlyViewedDish,
} from '../../types/rating';

interface RateDishScreenProps {
  dish: RecentlyViewedDish;
  currentIndex: number;
  totalDishes: number;
  onSubmit: (rating: DishRatingInput) => void;
  onBack: () => void;
  onAddPhoto: () => Promise<string | undefined>;
}

export function RateDishScreen({
  dish,
  currentIndex,
  totalDishes,
  onSubmit,
  onBack,
  onAddPhoto,
}: RateDishScreenProps) {
  const [opinion, setOpinion] = useState<DishOpinion | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<DishTag>>(new Set());
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  // Reset state when dish changes
  useEffect(() => {
    setOpinion(null);
    setSelectedTags(new Set());
    setPhotoUri(undefined);
  }, [dish.id]);

  const availableTags =
    opinion === 'liked' ? POSITIVE_DISH_TAGS : opinion === 'disliked' ? NEGATIVE_DISH_TAGS : [];

  const toggleTag = (tag: DishTag) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  const handleAddPhoto = async () => {
    const uri = await onAddPhoto();
    if (uri) {
      setPhotoUri(uri);
    }
  };

  const handleSubmit = () => {
    if (!opinion) return;

    onSubmit({
      dishId: dish.id,
      dishName: dish.name,
      opinion,
      tags: Array.from(selectedTags),
      photoUri,
    });
  };

  const canContinue = opinion !== null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.progress}>
          {currentIndex + 1} of {totalDishes}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>How was the {dish.name}?</Text>

        {/* Opinion Selection */}
        <View style={styles.opinionContainer}>
          <TouchableOpacity
            style={[styles.opinionButton, opinion === 'liked' && styles.opinionButtonLiked]}
            onPress={() => {
              setOpinion('liked');
              setSelectedTags(new Set());
            }}
          >
            <Text style={styles.opinionEmoji}>👍</Text>
            <Text style={[styles.opinionText, opinion === 'liked' && styles.opinionTextSelected]}>
              Loved it
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.opinionButton, opinion === 'okay' && styles.opinionButtonOkay]}
            onPress={() => {
              setOpinion('okay');
              setSelectedTags(new Set());
            }}
          >
            <Text style={styles.opinionEmoji}>😐</Text>
            <Text style={[styles.opinionText, opinion === 'okay' && styles.opinionTextSelected]}>
              Okay
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.opinionButton, opinion === 'disliked' && styles.opinionButtonDisliked]}
            onPress={() => {
              setOpinion('disliked');
              setSelectedTags(new Set());
            }}
          >
            <Text style={styles.opinionEmoji}>👎</Text>
            <Text
              style={[styles.opinionText, opinion === 'disliked' && styles.opinionTextSelected]}
            >
              Not for me
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tags Section (only for liked or disliked) */}
        {availableTags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsTitle}>
              {opinion === 'liked' ? 'What made it great?' : 'What could be better?'}
            </Text>
            <View style={styles.tagsContainer}>
              {availableTags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagButton, selectedTags.has(tag) && styles.tagButtonSelected]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagText, selectedTags.has(tag) && styles.tagTextSelected]}>
                    {DISH_TAG_LABELS[tag]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoButton} onPress={handleAddPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>📸</Text>
                <Text style={styles.photoText}>Add a dish photo</Text>
                <Text style={styles.photoSubtext}>(optional)</Text>
              </View>
            )}
          </TouchableOpacity>
          {photoUri && (
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => setPhotoUri(undefined)}
            >
              <Text style={styles.removePhotoText}>Remove photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canContinue}
        >
          <Text style={styles.continueButtonText}>
            {currentIndex < totalDishes - 1 ? 'Next' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.darkSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: colors.darkText,
  },
  progress: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  opinionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
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
  },
  tagsSubtitle: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
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
  tagButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tagText: {
    fontSize: typography.size.sm,
    color: colors.darkText,
  },
  tagTextSelected: {
    color: colors.white,
    fontWeight: typography.weight.medium,
  },
  photoSection: {
    alignItems: 'center',
  },
  photoButton: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: colors.darkSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.darkBorderLight,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
  },
  photoIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  photoText: {
    fontSize: typography.size.base,
    color: colors.darkText,
  },
  photoSubtext: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    marginTop: 2,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.lg,
  },
  removePhotoButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  removePhotoText: {
    fontSize: typography.size.sm,
    color: colors.error,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  continueButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: colors.darkTertiary,
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
});
