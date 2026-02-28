/**
 * Language Selector Component
 *
 * Allows users to select their preferred language for the app.
 * Updates both i18n language and persists preference in AsyncStorage.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getSupportedLanguages, getCurrentLanguage } from '../i18n';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface LanguageSelectorProps {
  onLanguageChange?: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onLanguageChange }) => {
  const { t } = useTranslation();
  const currentLanguage = getCurrentLanguage();
  const supportedLanguages = getSupportedLanguages();

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await changeLanguage(languageCode as 'en' | 'es' | 'pl');
      onLanguageChange?.();
    } catch (error) {
      console.error('[LanguageSelector] Failed to change language:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings.language')}</Text>
      <Text style={styles.subtitle}>
        {t('common.select')} {t('settings.language').toLowerCase()}
      </Text>

      <View style={styles.languagesContainer}>
        {supportedLanguages.map(language => (
          <TouchableOpacity
            key={language.code}
            style={[
              styles.languageOption,
              currentLanguage === language.code && styles.selectedLanguage,
            ]}
            onPress={() => handleLanguageChange(language.code)}
            activeOpacity={0.7}
          >
            <View style={styles.languageContent}>
              <Text style={styles.flag}>{language.flag}</Text>
              <View style={styles.languageText}>
                <Text
                  style={[
                    styles.languageName,
                    currentLanguage === language.code && styles.selectedText,
                  ]}
                >
                  {language.name}
                </Text>
              </View>
              {currentLanguage === language.code && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.darkTextSecondary,
    marginBottom: spacing.lg,
  },
  languagesContainer: {
    gap: spacing.md,
  },
  languageOption: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedLanguage: {
    borderColor: colors.accent,
    backgroundColor: `${colors.accent}10`,
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  languageText: {
    flex: 1,
  },
  languageName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.medium,
    color: colors.white,
    marginBottom: 2,
  },
  currencyInfo: {
    fontSize: typography.size.sm,
    color: colors.darkTextSecondary,
  },
  selectedText: {
    color: colors.accent,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
});
