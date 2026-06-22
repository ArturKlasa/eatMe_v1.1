/**
 * Price Range Section (presentational)
 *
 * Renders the dual-range price slider. Receives its slice of the draft as
 * `value` props and emits changes via callbacks; owns no draft state (D-03).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { modals } from '@/styles';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../../utils/i18nUtils';
import { DualRangeSlider } from '../DualRangeSlider';

interface PriceSectionProps {
  valueMin: number;
  valueMax: number;
  priceMin: number;
  priceMax: number;
  priceStep: number;
  currency: string;
  onValuesChange: (min: number, max: number) => void;
  onDragStateChange: (dragging: boolean) => void;
}

export const PriceSection: React.FC<PriceSectionProps> = ({
  valueMin,
  valueMax,
  priceMin,
  priceMax,
  priceStep,
  currency,
  onValuesChange,
  onDragStateChange,
}) => {
  const { t } = useTranslation();
  return (
    <View style={[modals.section, { marginTop: -20 }]}>
      <Text style={[modals.sectionTitle, modals.darkSectionTitle]}>
        💰 {t('filters.priceRange')}
      </Text>
      <View style={modals.priceSliderContainer}>
        <View style={modals.priceSliderLabels}>
          <Text style={[modals.priceSliderLabel, modals.darkPriceLabel]}>
            {valueMin === priceMin
              ? `${t('filters.lessThan')} ${formatCurrency(priceMin, currency)}`
              : formatCurrency(valueMin, currency)}
          </Text>
          <Text style={[modals.priceSliderLabel, modals.darkPriceLabel]}>
            {valueMax === priceMax
              ? `${t('filters.over')} ${formatCurrency(priceMax, currency)}`
              : formatCurrency(valueMax, currency)}
          </Text>
        </View>
        <DualRangeSlider
          min={priceMin}
          max={priceMax}
          step={priceStep}
          valueMin={valueMin}
          valueMax={valueMax}
          onValuesChange={onValuesChange}
          onDragStateChange={onDragStateChange}
        />
      </View>
    </View>
  );
};
