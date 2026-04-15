import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '@eatme/tokens';
import type { DishWithGroups } from './DishGrouping';

interface VariantPickerSheetProps {
  visible: boolean;
  parent: DishWithGroups | null;
  variants: DishWithGroups[];
  onSelect: (variant: DishWithGroups) => void;
  onClose: () => void;
}

export function VariantPickerSheet({
  visible,
  parent,
  variants,
  onSelect,
  onClose,
}: VariantPickerSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const minPrice = variants.reduce(
    (acc, v) => (v.price != null && v.price < acc ? v.price : acc),
    Infinity
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* stopPropagation: tapping the sheet itself should not dismiss */}
        <Pressable
          onPress={e => e.stopPropagation()}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>
            {parent?.name ?? t('restaurant.chooseVariant', 'Choose a variant')}
          </Text>
          {parent?.description ? (
            <Text style={styles.description}>{parent.description}</Text>
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={{ paddingVertical: spacing.sm }}>
            {variants.map(variant => {
              const delta =
                variant.price != null && Number.isFinite(minPrice) ? variant.price - minPrice : 0;
              return (
                <TouchableOpacity
                  key={variant.id}
                  style={styles.row}
                  onPress={() => onSelect(variant)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.variantName}>{variant.name}</Text>
                    {variant.description ? (
                      <Text style={styles.variantDescription} numberOfLines={2}>
                        {variant.description}
                      </Text>
                    ) : null}
                    {variant.serves && variant.serves > 1 ? (
                      <Text style={styles.variantMeta}>
                        {t('restaurant.serves', { count: variant.serves })}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.priceColumn}>
                    <Text style={styles.price}>
                      {variant.price != null ? `$${variant.price.toFixed(2)}` : '—'}
                    </Text>
                    {delta > 0 ? <Text style={styles.priceDelta}>+${delta.toFixed(2)}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
            {variants.length === 0 && (
              <Text style={styles.empty}>
                {t('restaurant.noVariants', 'No variants available.')}
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel', 'Cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  description: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  variantName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  variantDescription: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  variantMeta: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  priceDelta: {
    fontSize: typography.size.sm,
    color: colors.accent,
    marginTop: 2,
  },
  empty: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  cancel: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelText: {
    fontSize: typography.size.base,
    color: colors.accent,
  },
});
