/**
 * AuthLanguageSelector
 *
 * Compact language-picker for auth screens (Login, Register).
 * Shows the current language as a trigger button; tapping it opens an
 * inline dropdown listing all supported languages.
 *
 * Owns its own open/closed state so the parent screen needs no extra
 * useState or handler for language switching.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getSupportedLanguages, changeLanguage } from '../../i18n';
import { colors, typography, spacing, borderRadius } from '@/styles/theme';

export const AuthLanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const supportedLanguages = getSupportedLanguages();
  const currentLanguage = i18n.language;
  const currentLang = supportedLanguages.find(l => l.code === currentLanguage);

  const handleSelect = async (code: 'en' | 'es' | 'pl') => {
    await changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setIsOpen(prev => !prev)}
        activeOpacity={0.7}
      >
        <Text style={styles.triggerText}>
          {currentLang?.flag} {currentLang?.name}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdown}>
          {supportedLanguages.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.option, currentLanguage === lang.code && styles.optionActive]}
              onPress={() => handleSelect(lang.code as 'en' | 'es' | 'pl')}
              activeOpacity={0.7}
            >
              <Text style={styles.optionText}>
                {lang.flag} {lang.name}
              </Text>
              {currentLanguage === lang.code && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  triggerText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  dropdown: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.base,
  },
  optionActive: {
    backgroundColor: colors.darkTertiary,
  },
  optionText: {
    color: colors.white,
    fontSize: typography.size.base,
  },
  checkmark: {
    color: colors.accent,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
});
