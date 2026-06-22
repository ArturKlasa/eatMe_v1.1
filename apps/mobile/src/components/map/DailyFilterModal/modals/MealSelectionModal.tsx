/**
 * Meal Selection Modal Component
 *
 * A modal for selecting specific dishes/meals beyond the popular options
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput } from 'react-native';
import { modals } from '@/styles';
import { colors, spacing, typography, borderRadius } from '@eatme/tokens';
import { useTranslation } from 'react-i18next';
import { ALL_MEALS } from '../constants';
import { toLocaleKey, searchBox } from '../helpers';

interface MealSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMeals: string[];
  onToggleMeal: (meal: string) => void;
}

export const MealSelectionModal: React.FC<MealSelectionModalProps> = ({
  visible,
  onClose,
  selectedMeals,
  onToggleMeal,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const filteredMeals = ALL_MEALS.filter(meal =>
    t(`filters.meals.${toLocaleKey(meal)}`)
      .toLowerCase()
      .includes(q)
  );
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={modals.overlay}>
        <View style={[modals.container, modals.darkContainer, { maxHeight: '80%' }]}>
          <View style={modals.header}>
            <Text style={[modals.title, modals.darkTitle]}>🍔 {t('filters.selectMeals')}</Text>
            <TouchableOpacity
              style={{
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.base,
                backgroundColor: colors.accent,
              }}
              onPress={onClose}
            >
              <Text
                style={{
                  fontSize: typography.size.sm,
                  color: colors.white,
                  fontWeight: typography.weight.semibold,
                }}
              >
                {t('common.done')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={searchBox.container}>
            <TextInput
              style={searchBox.input}
              placeholder={t('common.search')}
              placeholderTextColor={colors.darkTextSecondary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>

          <ScrollView style={modals.content} showsVerticalScrollIndicator={true}>
            <View style={modals.cuisineGrid}>
              {filteredMeals.map(meal => (
                <TouchableOpacity
                  key={meal}
                  style={[
                    modals.cuisineOption,
                    selectedMeals.includes(meal) && modals.selectedOption,
                  ]}
                  onPress={() => onToggleMeal(meal)}
                >
                  <Text
                    style={[
                      modals.cuisineText,
                      modals.darkCuisineText,
                      selectedMeals.includes(meal) && modals.selectedText,
                    ]}
                  >
                    {t(`filters.meals.${toLocaleKey(meal)}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
