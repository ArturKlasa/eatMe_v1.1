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
import {
  deriveSizeFromPrice,
  formatPrice,
  isSupportedCurrency,
  type SupportedCurrency,
} from '@eatme/shared';
import { DishRatingBadge } from '../../components/DishRatingBadge';
import { type DishRating } from '../../services/dishRatingService';
import { type DishOpinion } from '../../types/rating';
import { type DishWithGroups } from './dishTypes';

interface DishMenuItemProps {
  item: DishWithGroups;
  /** Precomputed by the parent (classify once); drives the dimmed "not for you" styling. */
  passesHardFilters: boolean;
  /** This dish's rating summary, resolved by the parent (null when none). Passing the
   *  resolved value — not the whole ratings Map — lets React.memo skip unaffected rows. */
  rating?: DishRating | null;
  /** ISO 4217 from the parent restaurant. Optional/string because stale cache
   *  or older Edge Function deploys may not include it; formatPrice falls back
   *  to USD when missing. */
  currencyCode?: string | null;
  /** The signed-in user's most recent opinion for this dish, if any. Drives the
   *  "You loved it" indicator when 'liked'. */
  userOpinion?: DishOpinion | null;
  /** Whether the dish is in the user's favorites — renders a ❤️ after the name.
   *  Distinct from userOpinion (saved vs rated). */
  isFavorite?: boolean;
  onPress: (item: DishWithGroups) => void;
}

export const DishMenuItem = React.memo(function DishMenuItem({
  item,
  passesHardFilters,
  rating,
  currencyCode,
  userOpinion,
  isFavorite,
  onPress,
}: DishMenuItemProps) {
  const { t } = useTranslation();

  const currency: SupportedCurrency | undefined = isSupportedCurrency(currencyCode)
    ? currencyCode
    : undefined;
  // Existing live dishes whose price lives entirely in a size group arrive with
  // price=null + the sizes as a modifier group (operator issue #4). New scans
  // are fixed at the data layer (price + display_price_prefix='from'); for older
  // data we derive the cheapest size here so the card reads "from $X" instead of
  // a bare "—"/"$0". Returns null for normal dishes, which keeps the usual path.
  const sizeFromPrice = deriveSizeFromPrice(item.price, item.option_groups);
  const formattedPrice = formatPrice(sizeFromPrice ?? item.price, currency);

  const pricePrefix = sizeFromPrice != null ? 'from' : item.display_price_prefix;
  let priceLabel: string;
  switch (pricePrefix) {
    case 'from':
      priceLabel = t('restaurant.price.from', { price: formattedPrice });
      break;
    case 'per_person':
      priceLabel = t('restaurant.price.perPerson', { price: formattedPrice });
      break;
    case 'market_price':
      priceLabel = t('restaurant.price.marketPrice');
      break;
    case 'ask_server':
      priceLabel = t('restaurant.price.askServer');
      break;
    default:
      priceLabel = formattedPrice;
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
            {item.primary_protein === 'vegan' && ' 🌱'}
            {item.primary_protein === 'vegetarian' && ' 🥬'}
            {isFavorite && ' ❤️'}
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
          {userOpinion === 'liked' && (
            <View style={styles.lovedPill}>
              <Text style={styles.lovedText}>👍 {t('restaurant.youLovedIt')}</Text>
            </View>
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
});
