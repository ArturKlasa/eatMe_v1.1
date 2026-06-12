import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatPrice, isSupportedCurrency, type SupportedCurrency } from '@eatme/shared';
import { useAuthStore } from '../stores/authStore';
import { pickImage, takePhoto, uploadDishPhoto } from '../services/dishPhotoService';
import { toggleFavorite, isFavorited } from '../services/favoritesService';
import { recordInteraction } from '../services/interactionService';
import { colors, typography, spacing, borderRadius } from '@eatme/tokens';
import type { OptionGroup } from '../lib/supabase';
import { InContextRating } from './rating/InContextRating';
import type { DishOpinion, DishTag } from '../types/rating';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Photo height inside the three-quarter sheet — compact so it doesn't dominate
// the reduced height (the old full-screen modal used a full SCREEN_WIDTH square).
const PHOTO_HEIGHT = Math.round(SCREEN_WIDTH * 0.6);

// With zero photos the sheet shrinks to its content (maxHeight, not fixed
// height), so the "no photos yet" placeholder gets a compact height instead of
// the full photo block.
const PHOTO_HEIGHT_EMPTY = 140;

// Render an option's price in the restaurant's currency: absolute when
// price_override is set (e.g. size variants), otherwise the signed delta.
// Mirrors ModifierGroupsList.formatOptionPrice.
function formatOptionPrice(
  opt: OptionGroup['options'][number],
  currency: SupportedCurrency | undefined
): string | null {
  if (opt.price_override != null) return formatPrice(opt.price_override, currency);
  if (opt.price_delta !== 0) {
    const sign = opt.price_delta > 0 ? '+' : '';
    return `${sign}${formatPrice(opt.price_delta, currency)}`;
  }
  return null;
}

interface DishPhoto {
  id: string;
  photo_url: string;
  user_id: string;
  created_at: string;
}

interface DishPhotoModalProps {
  visible: boolean;
  onClose: () => void;
  dishId: string;
  dishName: string;
  dishDescription?: string;
  dishPrice: number;
  displayPricePrefix?: string;
  optionGroups?: OptionGroup[];
  photos: DishPhoto[];
  onPhotoAdded?: () => void;
  restaurantId?: string;
  /** ISO 4217 from the parent restaurant. Drives the header price label + each
   *  option's price chip. Optional/string because older caller stacks may not
   *  thread it through; formatPrice falls back to USD when missing. */
  currencyCode?: string | null;
  existingOpinion?: DishOpinion | null;
  onRated?: (opinion: DishOpinion, tags: DishTag[]) => void;
  /** Saved (favorited) state known by the caller. When provided, the heart
   *  initializes from it without a per-open isFavorited query. */
  initialSaved?: boolean;
  /** Fired whenever the saved state changes inside the sheet (heart toggle, or
   *  the implicit auto-favorite when rating "Loved it") so the caller can keep
   *  menu-level favorite indicators in sync. */
  onFavoriteChange?: (saved: boolean) => void;
}

export function DishPhotoModal({
  visible,
  onClose,
  dishId,
  dishName,
  dishDescription,
  dishPrice,
  displayPricePrefix = 'exact',
  optionGroups = [],
  photos,
  onPhotoAdded,
  restaurantId,
  currencyCode,
  existingOpinion = null,
  onRated,
  initialSaved,
  onFavoriteChange,
}: DishPhotoModalProps) {
  const currency: SupportedCurrency | undefined = isSupportedCurrency(currencyCode)
    ? currencyCode
    : undefined;
  const formattedDishPrice = formatPrice(dishPrice, currency);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const photoScrollRef = useRef<ScrollView>(null);
  const user = useAuthStore(state => state.user);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Saved state when the modal opens: trust the caller's initialSaved when
  // provided (re-syncs if it changes, e.g. favorites finish loading after the
  // sheet opened); otherwise fall back to a per-open isFavorited query.
  useEffect(() => {
    if (!visible || !user) {
      setIsSaved(false);
      return;
    }
    if (initialSaved !== undefined) {
      setIsSaved(initialSaved);
      return;
    }
    isFavorited(user.id, 'dish', dishId).then(result => {
      if (result.ok) setIsSaved(result.data);
    });
  }, [visible, dishId, user?.id, initialSaved]);

  const handleLike = async () => {
    if (!user) {
      Alert.alert(t('common.signInRequired'), t('common.signInToSave'));
      return;
    }
    setLikeLoading(true);
    try {
      const result = await toggleFavorite(user.id, 'dish', dishId);
      if (result.ok) {
        setIsSaved(result.data);
        onFavoriteChange?.(result.data);
        // Only record 'liked' interaction when saving (not when un-saving)
        if (result.data) {
          recordInteraction(user.id, dishId, 'liked');
        }
      }
    } finally {
      setLikeLoading(false);
    }
  };

  const handleAddPhoto = () => {
    if (!user) {
      Alert.alert(t('common.signInRequired'), t('common.signInToUpload'));
      return;
    }

    Alert.alert(t('common.addPhoto'), t('common.addPhoto'), [
      {
        text: t('common.takePhoto'),
        onPress: handleTakePhoto,
      },
      {
        text: t('common.chooseFromLibrary'),
        onPress: handlePickImage,
      },
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
    ]);
  };

  const handleTakePhoto = async () => {
    const photoUri = await takePhoto();
    if (photoUri) {
      await uploadPhoto(photoUri);
    }
  };

  const handlePickImage = async () => {
    const photoUri = await pickImage();
    if (photoUri) {
      await uploadPhoto(photoUri);
    }
  };

  const uploadPhoto = async (photoUri: string) => {
    if (!user) return;

    setUploading(true);
    const result = await uploadDishPhoto(user.id, dishId, photoUri);

    if (result.success) {
      Alert.alert(t('common.success'), t('common.photoUploadSuccess'));
      onPhotoAdded?.(); // Trigger refresh
    } else {
      Alert.alert(t('common.error'), t('common.photoUploadError'));
    }
    setUploading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tap the dimmed strip above the sheet to dismiss. This is a
            separate absolute-fill Pressable behind the sheet — NOT a wrapper —
            so the sheet's ScrollView has no Pressable ancestor that would
            swallow its vertical scroll gesture (RN: a Pressable wrapping a
            ScrollView can block scrolling). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.dishName}>{dishName}</Text>
              <Text style={styles.dishPrice}>
                {displayPricePrefix === 'from' &&
                  t('restaurant.price.from', { price: formattedDishPrice })}
                {displayPricePrefix === 'per_person' &&
                  t('restaurant.price.perPerson', { price: formattedDishPrice })}
                {displayPricePrefix === 'market_price' && t('restaurant.price.marketPrice')}
                {displayPricePrefix === 'ask_server' && t('restaurant.price.askServer')}
                {(!displayPricePrefix || displayPricePrefix === 'exact') && formattedDishPrice}
              </Text>
            </View>
            {/* Like / save button */}
            <TouchableOpacity
              onPress={handleLike}
              disabled={likeLoading}
              style={styles.likeButton}
              accessibilityLabel={isSaved ? 'Remove from saved' : 'Save dish'}
            >
              {likeLoading ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={[styles.likeIcon, isSaved && styles.likeIconActive]}>
                  {isSaved ? '❤️' : '🤍'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Scrollable body: photo, thumbnails, rating, description, options */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* Main Photo */}
            <View
              style={[
                styles.mainPhotoContainer,
                photos.length === 0 && styles.mainPhotoContainerEmpty,
              ]}
            >
              {photos.length > 0 ? (
                <ScrollView
                  ref={photoScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={photos.length > 1}
                  onScroll={e => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    if (index !== selectedPhotoIndex) setSelectedPhotoIndex(index);
                  }}
                  scrollEventThrottle={16}
                >
                  {photos.map(photo => (
                    <Image
                      key={photo.id}
                      source={{ uri: photo.photo_url }}
                      style={styles.mainPhoto}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.noPhotoContainer}>
                  <Text style={styles.noPhotoIcon}>📸</Text>
                  <Text style={styles.noPhotoText}>{t('dish.noPhotos')}</Text>
                  <Text style={styles.noPhotoSubtext}>{t('dish.beFirstToShare')}</Text>
                </View>
              )}

              {/* Photo Counter */}
              {photos.length > 1 && (
                <View style={styles.photoCounter}>
                  <Text style={styles.photoCounterText}>
                    {selectedPhotoIndex + 1} / {photos.length}
                  </Text>
                </View>
              )}
            </View>

            {/* Photo Thumbnails + Add Photo */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbnailScroll}
              contentContainerStyle={styles.thumbnailContent}
            >
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id}
                  onPress={() => {
                    setSelectedPhotoIndex(index);
                    photoScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
                  }}
                  style={[
                    styles.thumbnail,
                    selectedPhotoIndex === index && styles.thumbnailSelected,
                  ]}
                >
                  <Image source={{ uri: photo.photo_url }} style={styles.thumbnailImage} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.addPhotoThumbnail}
                onPress={handleAddPhoto}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.darkTextSecondary} size="small" />
                ) : (
                  <>
                    <Text style={styles.addPhotoThumbnailIcon}>📷</Text>
                    <Text style={styles.addPhotoThumbnailText}>{t('dish.addYourPhoto')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>

            {/* Dish Info */}
            <View style={styles.infoSection}>
              {user && restaurantId && (
                <InContextRating
                  dishId={dishId}
                  dishName={dishName}
                  restaurantId={restaurantId}
                  existingOpinion={existingOpinion}
                  onRated={(opinion, tags) => {
                    // "Loved it" auto-saves to favorites server-side
                    // (ratingService.autoFavoriteLovedDish) — mirror it here so
                    // the heart fills immediately instead of on next open.
                    if (opinion === 'liked' && !isSaved) {
                      setIsSaved(true);
                      onFavoriteChange?.(true);
                    }
                    onRated?.(opinion, tags);
                  }}
                />
              )}

              {dishDescription && (
                <View style={styles.descriptionContainer}>
                  <Text style={styles.descriptionLabel}>{t('dish.description')}</Text>
                  <Text style={styles.description}>{dishDescription}</Text>
                </View>
              )}

              {/* Option Groups */}
              {optionGroups.length > 0 && (
                <View style={styles.optionGroupsContainer}>
                  {optionGroups.map(group => {
                    const isRequired = group.min_selections > 0;
                    return (
                      <View key={group.id} style={styles.optionGroup}>
                        <View style={styles.optionGroupHeader}>
                          <Text style={styles.optionGroupName}>{group.name}</Text>
                          <Text style={styles.optionGroupMeta}>
                            {isRequired ? t('dish.optionRequired') : t('dish.optionOptional')}
                            {group.selection_type === 'single' ? ` ${t('dish.optionPickOne')}` : ''}
                            {group.selection_type === 'multiple' && group.max_selections
                              ? ` ${t('dish.optionUpTo', { count: group.max_selections })}`
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.optionList}>
                          {group.options.map(opt => {
                            const priceLabel = formatOptionPrice(opt, currency);
                            return (
                              <View key={opt.id} style={styles.optionListRow}>
                                <View style={styles.optionListRowMain}>
                                  <Text style={styles.optionListName}>{opt.name}</Text>
                                  {priceLabel != null && (
                                    <Text style={styles.optionPrice}>{priceLabel}</Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    // Adaptive: wraps content (no dead space below dishes without modifiers),
    // capped at three quarters of the screen — longer content scrolls.
    maxHeight: '75%',
    backgroundColor: colors.dark,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.darkTextMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  body: {
    // Size to content so the sheet can shrink (see sheet.maxHeight); shrink —
    // and become scrollable — when content exceeds the cap.
    flexGrow: 0,
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  likeIcon: {
    fontSize: 24,
    opacity: 0.5,
  },
  likeIconActive: {
    opacity: 1,
  },
  closeButtonText: {
    fontSize: typography.size['2xl'],
    color: colors.white,
  },
  headerInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  dishName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  dishPrice: {
    fontSize: typography.size.base,
    color: colors.accent,
    marginTop: 2,
  },
  mainPhotoContainer: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
    backgroundColor: colors.black,
    position: 'relative',
  },
  mainPhotoContainerEmpty: {
    height: PHOTO_HEIGHT_EMPTY,
  },
  mainPhoto: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
  },
  noPhotoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkSecondary,
  },
  noPhotoIcon: {
    fontSize: typography.size['6xl'],
    marginBottom: spacing.base,
  },
  noPhotoText: {
    fontSize: typography.size.lg,
    color: colors.white,
    fontWeight: typography.weight.semibold,
  },
  noPhotoSubtext: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    marginTop: spacing.xs,
  },
  photoCounter: {
    position: 'absolute',
    bottom: spacing.base,
    right: spacing.base,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm / 2,
    borderRadius: spacing.base,
  },
  photoCounterText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  thumbnailScroll: {
    maxHeight: 80,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
  },
  thumbnailContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.base,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailSelected: {
    borderColor: colors.accent,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    padding: spacing.base,
  },
  descriptionContainer: {
    marginBottom: spacing.base,
  },
  descriptionLabel: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: typography.size.base,
    color: colors.white,
    lineHeight: 22,
  },
  addPhotoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.base,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkSecondary,
  },
  addPhotoThumbnailIcon: {
    fontSize: 18,
  },
  addPhotoThumbnailText: {
    fontSize: 9,
    color: colors.darkTextSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  photosFromCommunity: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    fontStyle: 'italic',
  },
  optionGroupsContainer: {
    marginBottom: spacing.base,
  },
  optionGroup: {
    marginBottom: spacing.base,
  },
  optionGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  optionGroupName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionGroupMeta: {
    fontSize: typography.size.xs,
    color: colors.darkTextMuted,
  },
  optionPrice: {
    fontSize: typography.size.xs,
    color: colors.accent,
  },
  optionList: {
    gap: spacing.xs,
  },
  optionListRow: {
    flexDirection: 'column',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.darkBorder,
  },
  optionListRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionListName: {
    fontSize: typography.size.sm,
    color: colors.white,
    flex: 1,
  },
});
