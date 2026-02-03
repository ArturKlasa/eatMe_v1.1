/**
 * Restaurant Question Screen
 *
 * Fourth step of the rating flow - user answers one random restaurant experience question.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import {
  RestaurantQuestionType,
  RestaurantFeedbackInput,
  RESTAURANT_QUESTIONS,
} from '../../types/rating';

interface RestaurantQuestionScreenProps {
  restaurantId: string;
  restaurantName: string;
  questionType: RestaurantQuestionType;
  onSubmit: (feedback: RestaurantFeedbackInput) => void;
  onSkip: () => void;
  onBack: () => void;
  onAddPhoto: () => Promise<string | undefined>;
}

export function RestaurantQuestionScreen({
  restaurantId,
  restaurantName,
  questionType,
  onSubmit,
  onSkip,
  onBack,
  onAddPhoto,
}: RestaurantQuestionScreenProps) {
  const [response, setResponse] = useState<boolean | null>(null);
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  const handleAddPhoto = async () => {
    const uri = await onAddPhoto();
    if (uri) {
      setPhotoUri(uri);
    }
  };

  const handleDone = () => {
    onSubmit({
      restaurantId,
      questionType,
      response: response!,
      photoUri,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>One quick question about {restaurantName}:</Text>
        <Text style={styles.question}>{RESTAURANT_QUESTIONS[questionType]}</Text>

        {/* Yes/No Buttons */}
        <View style={styles.responseContainer}>
          <TouchableOpacity
            style={[styles.responseButton, response === true && styles.responseButtonYes]}
            onPress={() => setResponse(true)}
          >
            <Text style={styles.responseEmoji}>👍</Text>
            <Text style={[styles.responseText, response === true && styles.responseTextSelected]}>
              Yes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.responseButton, response === false && styles.responseButtonNo]}
            onPress={() => setResponse(false)}
          >
            <Text style={styles.responseEmoji}>👎</Text>
            <Text style={[styles.responseText, response === false && styles.responseTextSelected]}>
              No
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoButton} onPress={handleAddPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>📸</Text>
                <Text style={styles.photoText}>Add a restaurant photo</Text>
                <Text style={styles.photoSubtext}>(interior, exterior, or ambiance)</Text>
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
      </View>

      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.doneButton, response === null && styles.doneButtonDisabled]}
            onPress={handleDone}
            disabled={response === null}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  question: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  responseContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  responseButton: {
    width: 120,
    height: 100,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.darkSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  responseButtonYes: {
    borderColor: colors.success,
    backgroundColor: `${colors.success}20`,
  },
  responseButtonNo: {
    borderColor: colors.error,
    backgroundColor: `${colors.error}20`,
  },
  responseEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  responseText: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
  },
  responseTextSelected: {
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
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipButton: {
    flex: 1,
    backgroundColor: colors.darkSecondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.darkText,
  },
  doneButton: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    backgroundColor: colors.darkTertiary,
    opacity: 0.5,
  },
  doneButtonText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
});
