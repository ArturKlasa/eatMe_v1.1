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
import { type PermanentFilters, type IngredientToAvoid } from '../../stores/filterStore';
import { type DishRating } from '../../services/dishRatingService';
import { type DishWithGroups } from './DishGrouping';

interface DishMenuItemProps {
  item: DishWithGroups;
  permanentFilters: PermanentFilters;
  ingredientsToAvoid: IngredientToAvoid[];
  dishRatings: Map<string, DishRating>;
  onPress: (item: DishWithGroups) => void;
}

export function DishMenuItem({
  item,
  permanentFilters,
  ingredientsToAvoid,
  dishRatings,
  onPress,
}: DishMenuItemProps) {
  const { t } = useTranslation();

  const rating = dishRatings.get(item.id);
  const pricePrefix = item.display_price_prefix;
  let priceLabel: string;
  switch (pricePrefix) {
    case 'from':
      priceLabel = `from $${item.price.toFixed(2)}`;
      break;
    case 'per_person':
      priceLabel = `$${item.price.toFixed(2)}/person`;
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

  const { passesHardFilters, flaggedIngredientNames } = classifyDish(
    item,
    permanentFilters,
    ingredientsToAvoid
  );

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
        <Text style={styles.menuItemPrice}>{priceLabel}</Text>
      </View>
      {item.description && item.description_visibility !== 'detail' && (
        <Text style={styles.menuItemIngredients}>{item.description}</Text>
      )}
      {item.ingredients_visibility === 'menu' && (item.ingredients?.length ?? 0) > 0 && (
        <Text style={styles.menuItemIngredients}>{item.ingredients!.join(', ')}</Text>
      )}
      {flaggedIngredientNames.length > 0 && (
        <Text style={styles.flaggedIngredientsWarning}>
          ⚠️ Contains: {flaggedIngredientNames.join(', ')}
        </Text>
      )}
    </TouchableOpacity>
  );
}
