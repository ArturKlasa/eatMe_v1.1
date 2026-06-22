/**
 * Dish / Meal Section (presentational)
 *
 * Renders the popular-meals grid + the "Other" button that opens the full
 * meal selection modal. The inline 11-item popular list is a DIFFERENT list
 * from ALL_MEALS (constants.ts) and is intentionally kept inline. Owns no
 * draft state (D-03).
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { modals } from '@/styles';
import { useTranslation } from 'react-i18next';
import { toLocaleKey } from '../helpers';

interface MealSectionProps {
  meals: string[];
  onToggleMeal: (meal: string) => void;
  onOpenAll: () => void;
}

export const MealSection: React.FC<MealSectionProps> = ({ meals, onToggleMeal, onOpenAll }) => {
  const { t } = useTranslation();
  return (
    <View style={modals.section}>
      <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>🍔 {t('filters.meal')}</Text>
      <View style={modals.cuisineGrid}>
        {[
          'Tacos',
          'Pizza',
          'Burger',
          'Pasta',
          'Sushi',
          'Salad',
          'Steak',
          'Ramen',
          'Sandwich',
          'Curry',
          'Burrito',
        ].map(meal => (
          <TouchableOpacity
            key={meal}
            style={[modals.cuisineOption, meals.includes(meal) && modals.selectedOption]}
            onPress={() => onToggleMeal(meal)}
          >
            <Text
              style={[
                modals.cuisineText,
                modals.darkCuisineText,
                meals.includes(meal) && modals.selectedText,
              ]}
            >
              {t(`filters.meals.${toLocaleKey(meal)}`)}
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
