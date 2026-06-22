/**
 * Cuisine Selection Modal Component
 *
 * A modal for selecting cuisines beyond the popular options
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput } from 'react-native';
import { modals } from '@/styles';
import { colors, spacing, typography, borderRadius } from '@eatme/tokens';
import { useTranslation } from 'react-i18next';
import { ALL_CUISINES } from '@eatme/shared';
import { toLocaleKey, searchBox } from '../helpers';

interface CuisineSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCuisines: string[];
  onToggleCuisine: (cuisine: string) => void;
}

export const CuisineSelectionModal: React.FC<CuisineSelectionModalProps> = ({
  visible,
  onClose,
  selectedCuisines,
  onToggleCuisine,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const filteredCuisines = ALL_CUISINES.filter(cuisine =>
    t(`filters.cuisines.${toLocaleKey(cuisine)}`)
      .toLowerCase()
      .includes(q)
  );
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={modals.overlay}>
        <View style={[modals.container, modals.darkContainer, { maxHeight: '80%' }]}>
          <View style={modals.header}>
            <Text style={[modals.title, modals.darkTitle]}>🍽️ {t('filters.selectCuisines')}</Text>
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
              {filteredCuisines.map(cuisine => (
                <TouchableOpacity
                  key={cuisine}
                  style={[
                    modals.cuisineOption,
                    selectedCuisines.includes(cuisine) && modals.selectedOption,
                  ]}
                  onPress={() => onToggleCuisine(cuisine)}
                >
                  <Text
                    style={[
                      modals.cuisineText,
                      modals.darkCuisineText,
                      selectedCuisines.includes(cuisine) && modals.selectedText,
                    ]}
                  >
                    {t(`filters.cuisines.${toLocaleKey(cuisine)}`)}
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
