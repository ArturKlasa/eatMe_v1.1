/**
 * Diet Preference / Protein Section (presentational)
 *
 * Renders the protein options + (conditionally) the meat sub-types row.
 * The protein/meat toggle special-casing (LANDMINE #3) lives in the PARENT
 * reducer — this section only renders the current `value` and calls the
 * `onToggleProtein` / `onToggleMeat` callbacks (D-03).
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { modals } from '@/styles';
import { useTranslation } from 'react-i18next';
import type { DailyFilters } from '../../../../stores/filterStore';

interface ProteinSectionProps {
  value: Pick<DailyFilters, 'dietPreference' | 'proteinTypes' | 'meatTypes'>;
  onToggleProtein: (key: string) => void;
  onToggleMeat: (key: string) => void;
}

export const ProteinSection: React.FC<ProteinSectionProps> = ({
  value,
  onToggleProtein,
  onToggleMeat,
}) => {
  const { t } = useTranslation();
  return (
    <View style={modals.section}>
      <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>
        🥗 {t('filters.dietPreferences')}
      </Text>

      {/* Protein Options */}
      <View style={modals.multiOptionContainer}>
        <View style={modals.optionsRow}>
          {[
            { key: 'meat', label: t('filters.proteinTypes.meat') },
            { key: 'fish', label: t('filters.proteinTypes.fish') },
            { key: 'seafood', label: t('filters.proteinTypes.seafood') },
            { key: 'egg', label: t('filters.proteinTypes.egg') },
            { key: 'vegetarian', label: t('filters.proteinTypes.vegetarian') },
            { key: 'vegan', label: t('filters.proteinTypes.vegan') },
          ].map(protein => {
            const isSelected =
              protein.key === 'vegetarian'
                ? value.dietPreference === 'vegetarian'
                : protein.key === 'vegan'
                  ? value.dietPreference === 'vegan'
                  : value.proteinTypes[protein.key as keyof typeof value.proteinTypes];

            return (
              <TouchableOpacity
                key={protein.key}
                style={[modals.option, isSelected && modals.selectedOption]}
                onPress={() => onToggleProtein(protein.key)}
              >
                <Text
                  style={[
                    modals.optionText,
                    modals.darkOptionText,
                    isSelected && modals.selectedText,
                  ]}
                >
                  {protein.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Meat sub-types — shown only when Meat is selected */}
        {value.proteinTypes.meat && (
          <View style={[modals.optionsRow, { marginTop: 8 }]}>
            {[
              { key: 'chicken', label: t('filters.meatTypes.chicken') },
              { key: 'beef', label: t('filters.meatTypes.beef') },
              { key: 'pork', label: t('filters.meatTypes.pork') },
              { key: 'lamb', label: t('filters.meatTypes.lamb') },
              { key: 'goat', label: t('filters.meatTypes.goat') },
              { key: 'other', label: t('filters.meatTypes.other') },
            ].map(meatType => {
              const isSelected = value.meatTypes[meatType.key as keyof typeof value.meatTypes];
              return (
                <TouchableOpacity
                  key={meatType.key}
                  style={[modals.option, isSelected && modals.selectedOption]}
                  onPress={() => onToggleMeat(meatType.key)}
                >
                  <Text
                    style={[
                      modals.optionText,
                      modals.darkOptionText,
                      isSelected && modals.selectedText,
                    ]}
                  >
                    {meatType.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};
