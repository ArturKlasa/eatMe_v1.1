/**
 * DishMenuItem
 *
 * Renders a single dish row in the menu list.
 * Handles price formatting, dietary tag icons, hard-filter dimming,
 * flagged-ingredient warnings, and rating badge display.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { restaurantDetailStyles as styles } from '@/styles';
import { useTranslation } from 'react-i18next';
import { DishRatingBadge } from '../../components/DishRatingBadge';
import { classifyDish } from '../../utils/menuFilterUtils';
import { type PermanentFilters } from '../../stores/filterStore';
import { type DishRating } from '../../services/dishRatingService';
import { type DishWithGroups } from './DishGrouping';

interface DishMenuItemProps {
  item: DishWithGroups;
  permanentFilters: PermanentFilters;
  dishRatings: Map<string, DishRating>;
  onPress: (item: DishWithGroups) => void;
}

export function DishMenuItem({ item, permanentFilters, dishRatings, onPress }: DishMenuItemProps) {
  const { t } = useTranslation();

  const rating = dishRatings.get(item.id);
  const pricePrefix = item.display_price_prefix;
  let priceLabel: string;
  switch (pricePrefix) {
    case 'from':
      priceLabel = t('restaurant.price.from', { price: `$${item.price.toFixed(2)}` });
      break;
    case 'per_person':
      priceLabel = t('restaurant.price.perPerson', { price: `$${item.price.toFixed(2)}` });
      break;
    case 'market_price':
      priceLabel = t('restaurant.price.marketPrice');
      break;
    case 'ask_server':
      priceLabel = t('restaurant.price.askServer');
      break;
    default:
      priceLabel = `$${item.price.toFixed(2)}`;
  }

  // Portion size (migration 145; 'oz' added migration 148). Renders inline
  // before the price as "250g · $12.00". Space before 'pcs'/'szt.'/'uds.' and
  // 'oz' reads better ("6 pcs", "8 oz" vs "6pcs"/"8oz"); 'g'/'ml' stay tight.
  const portionSpaced = item.portion_unit === 'pcs' || item.portion_unit === 'oz';
  const portionLabel =
    item.portion_amount != null && item.portion_unit
      ? `${item.portion_amount}${portionSpaced ? ' ' : ''}${t(`restaurant.portionUnit.${item.portion_unit}`)}`
      : null;
  const fullPriceLabel = portionLabel ? `${portionLabel} · ${priceLabel}` : priceLabel;

  const { passesHardFilters } = classifyDish(item, permanentFilters);

  return (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, !passesHardFilters && { opacity: 0.35 }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemHeader}>
        <View style={styles.menuItemNameContainer}>
          <Text style={styles.menuItemName}>
            {item.name}
            {item.dietary_tags?.includes('vegan') && ' 🌱'}
            {item.dietary_tags?.includes('vegetarian') &&
              !item.dietary_tags?.includes('vegan') &&
              ' 🥬'}
          </Text>
          {!passesHardFilters && (
            <View style={styles.notForYouPill}>
              <Text style={styles.notForYouText}>{t('restaurant.notForYou')}</Text>
            </View>
          )}
          {rating && (
            <DishRatingBadge
              likePercentage={rating.likePercentage}
              totalRatings={rating.totalRatings}
              topTags={rating.topTags}
            />
          )}
        </View>
        <Text style={styles.menuItemPrice}>{fullPriceLabel}</Text>
      </View>
      {item.description && item.description_visibility !== 'detail' && (
        <Text style={styles.menuItemIngredients}>{item.description}</Text>
      )}
      {item.ingredients_visibility === 'menu' && (item.ingredients?.length ?? 0) > 0 && (
        <Text style={styles.menuItemIngredients}>{item.ingredients!.join(', ')}</Text>
      )}
      {/* Bundled items: e.g. "comes with: Soup of the day, Side salad" */}
      {Array.isArray(item.bundled_items) && item.bundled_items.length > 0 && (
        <Text style={styles.menuItemIngredients}>
          {t('restaurant.comesWith', 'comes with')}:{' '}
          {(item.bundled_items as Array<{ name: string; note?: string | null }>)
            .map(b => (b.note ? `${b.name} (${b.note})` : b.name))
            .join(', ')}
        </Text>
      )}
    </TouchableOpacity>
  );
}
