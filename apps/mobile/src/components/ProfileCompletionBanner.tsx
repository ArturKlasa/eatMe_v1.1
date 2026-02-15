/**
 * Profile Completion Banner
 *
 * Gentle, non-blocking prompt to complete user preferences.
 * Shows profile completion percentage and points.
 * Can be dismissed, respects cooldown periods.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useOnboardingStore } from '../stores/onboardingStore';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface ProfileCompletionBannerProps {
  onStartOnboarding: () => void;
}

export const ProfileCompletionBanner: React.FC<ProfileCompletionBannerProps> = ({
  onStartOnboarding,
}) => {
  const {
    profileCompletion,
    profilePoints,
    isCompleted,
    shouldShowPrompt,
    dismissPrompt,
    recordPromptShown,
  } = useOnboardingStore();

  const [isVisible, setIsVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Check if we should show the banner
    if (shouldShowPrompt()) {
      setIsVisible(true);
      recordPromptShown();

      // Animate in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, []);

  const handleDismiss = () => {
    // Animate out
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      dismissPrompt();
    });
  };

  const handleComplete = () => {
    handleDismiss();
    setTimeout(() => {
      onStartOnboarding();
    }, 300);
  };

  if (!isVisible || isCompleted) {
    return null;
  }

  // Determine message based on completion percentage
  const getMessage = () => {
    if (profileCompletion === 0) {
      return {
        title: '🎯 Personalize Your Experience',
        subtitle: 'Get better dish recommendations',
        points: 'Earn up to 100 points!',
      };
    } else if (profileCompletion < 50) {
      return {
        title: `${profileCompletion}% Complete - Keep Going!`,
        subtitle: 'Just a few more preferences',
        points: `${profilePoints} points earned`,
      };
    } else {
      return {
        title: `${profileCompletion}% Complete - Almost There!`,
        subtitle: 'Finish to unlock full personalization',
        points: `${profilePoints} points earned`,
      };
    }
  };

  const message = getMessage();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Progress Bar Background */}
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${profileCompletion}%` }]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Left side - Text */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{message.title}</Text>
          <Text style={styles.subtitle}>{message.subtitle}</Text>
          <Text style={styles.points}>{message.points}</Text>
        </View>

        {/* Right side - Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleComplete}
            activeOpacity={0.8}
          >
            <Text style={styles.completeButtonText}>
              {profileCompletion > 0 ? 'Continue' : 'Start'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.darkSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorderLight,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: colors.darkTertiary,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typography.size.xs,
    color: colors.darkTextSecondary,
    marginBottom: 4,
  },
  points: {
    fontSize: typography.size.xs,
    color: colors.accent,
    fontWeight: typography.weight.medium,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  completeButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
  },
  completeButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.darkTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
  },
});
