/**
 * Rating Banner
 *
 * Presentational top-of-screen banner prompting the user to rate recently-viewed
 * restaurants. Tap opens the rating flow. Visibility is controlled by the parent.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/styles/theme';

interface RatingBannerProps {
  onPress: () => void;
}

export const RatingBanner = React.memo<RatingBannerProps>(function RatingBanner({ onPress }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top,
        left: 16,
        right: 16,
        zIndex: 1000,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        style={{
          backgroundColor: colors.darkSecondary,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: colors.darkBorder,
          shadowColor: colors.black,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, marginRight: spacing.sm }}>🎁</Text>
          <Text
            style={{
              color: colors.accent,
              fontSize: typography.size.base,
              fontWeight: typography.weight.semibold,
            }}
          >
            {t('map.rateDishesGetRewards')}
          </Text>
        </View>
        <Text style={{ color: colors.accent, fontSize: typography.size.lg }}>→</Text>
      </TouchableOpacity>
    </View>
  );
});
