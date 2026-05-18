/**
 * ForceUpdateScreen — full-screen blocking gate rendered when the installed
 * mobile app version is below `app_config.min_supported_mobile_version`.
 *
 * No skip button. The only action is to open the platform-appropriate store
 * URL. The Phase 6 force-upgrade gate depends on this being a hard wall —
 * see docs/plans/dish-model-rewrite-phase-1-database.md §6.
 */

import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '@eatme/tokens';

import i18n from '../../i18n';
import type { AppConfig } from '../../services/appConfigService';

interface Props {
  config: AppConfig;
}

export function ForceUpdateScreen({ config }: Props): React.JSX.Element {
  const url = Platform.OS === 'ios' ? config.update_url_ios : config.update_url_android;
  const ctaLabel =
    Platform.OS === 'ios'
      ? i18n.t('appVersionGate.openAppStore')
      : i18n.t('appVersionGate.openPlayStore');

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{i18n.t('appVersionGate.title')}</Text>
        <Text style={styles.message}>{i18n.t('appVersionGate.message')}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL(url).catch(() => undefined)}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.buttonLabel}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.darkText,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.size.base,
    color: colors.gray400,
    marginBottom: spacing.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  buttonLabel: {
    color: colors.textInverse,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
