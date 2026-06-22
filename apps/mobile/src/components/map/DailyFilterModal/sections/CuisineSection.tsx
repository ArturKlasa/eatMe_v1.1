/**
 * Cuisine Section (presentational)
 *
 * Renders the popular-cuisine grid + the "Other" button that opens the full
 * cuisine selection modal. Owns no draft state (D-03).
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { modals } from '@/styles';
import { useTranslation } from 'react-i18next';
import { POPULAR_CUISINES } from '@eatme/shared';
import { toLocaleKey } from '../helpers';

interface CuisineSectionProps {
  cuisineTypes: string[];
  onToggleCuisine: (cuisine: string) => void;
  onOpenAll: () => void;
}

export const CuisineSection: React.FC<CuisineSectionProps> = ({
  cuisineTypes,
  onToggleCuisine,
  onOpenAll,
}) => {
  const { t } = useTranslation();
  return (
    <View style={modals.section}>
      <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>🍽️ {t('filters.cuisine')}</Text>
      <View style={modals.cuisineGrid}>
        {POPULAR_CUISINES.map(cuisine => (
          <TouchableOpacity
            key={cuisine}
            style={[modals.cuisineOption, cuisineTypes.includes(cuisine) && modals.selectedOption]}
            onPress={() => onToggleCuisine(cuisine)}
          >
            <Text
              style={[
                modals.cuisineText,
                modals.darkCuisineText,
                cuisineTypes.includes(cuisine) && modals.selectedText,
              ]}
            >
              {t(`filters.cuisines.${toLocaleKey(cuisine)}`)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={modals.cuisineOption} onPress={onOpenAll}>
          <Text style={[modals.cuisineText, modals.darkCuisineText]}>{t('common.other')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
