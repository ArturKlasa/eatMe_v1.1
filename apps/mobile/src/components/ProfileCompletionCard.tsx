/**
 * Profile Completion Card
 *
 * Shows profile completion status in the profile/settings screen.
 * Displays progress bar, completion percentage, points earned, and benefits.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useOnboardingStore } from '../stores/onboardingStore';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface ProfileCompletionCardProps {
  onPress: () => void;
}

export const ProfileCompletionCard: React.FC<ProfileCompletionCardProps> = ({ onPress }) => {
  const { profileCompletion, profilePoints, isCompleted } = useOnboardingStore();

  const pointsToNext = 100 - profilePoints;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Profile Preferences</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>{profilePoints}</Text>
          <Text style={styles.pointsLabel}>points</Text>
        </View>
      </View>

      {/* Progress Section */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Completion</Text>
          <Text style={styles.progressPercentage}>{profileCompletion}%</Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${profileCompletion}%`,
                  backgroundColor: colors.accent,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Benefits */}
      {profileCompletion < 100 && (
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>
            {profileCompletion === 0
              ? '✨ Complete your profile to:'
              : `🎁 ${pointsToNext} more points available:`}
          </Text>
          <Text style={styles.benefitItem}>• Get personalized dish recommendations</Text>
          <Text style={styles.benefitItem}>• Save your preferences for quick filters</Text>
          <Text style={styles.benefitItem}>• Discover restaurants matching your taste</Text>
        </View>
      )}

      {/* CTA */}
      <View style={styles.ctaSection}>
        {profileCompletion === 100 ? (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓ Profile Complete</Text>
            <Text style={styles.completedSubtext}>Tap to review preferences</Text>
          </View>
        ) : (
          <View style={styles.ctaButton}>
            <Text style={styles.ctaText}>
              {profileCompletion > 0 ? 'Continue Setup →' : 'Start Setup →'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.darkBorderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  pointsBadge: {
    backgroundColor: colors.darkTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  pointsText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.accent,
  },
  pointsLabel: {
    fontSize: typography.size.xs,
    color: colors.darkTextSecondary,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
  },
  progressPercentage: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  progressBarContainer: {
    width: '100%',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.darkTertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  benefitsSection: {
    marginBottom: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.darkBorderLight,
  },
  benefitsTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  benefitItem: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
    marginLeft: spacing.sm,
    marginTop: 2,
  },
  ctaSection: {
    marginTop: spacing.xs,
  },
  ctaButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  completedBadge: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  completedText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.success,
  },
  completedSubtext: {
    fontSize: typography.size.xs,
    color: colors.darkTextSecondary,
    marginTop: 2,
  },
});
