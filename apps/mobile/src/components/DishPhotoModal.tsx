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

const KIND_BADGE: Record<string, string> = {
  configurable: '  🔧',
  course_menu: '  🍷',
  buffet: '  🍱',
  bundle: '  🎁',
  // 'standard' intentionally has no badge
};

// Render an option's price: absolute when price_override is set (e.g. size
// variants), otherwise the +/- delta. Mirrors ModifierGroupsList.formatPrice.
function formatOptionPrice(opt: OptionGroup['options'][number]): string | null {
  if (opt.price_override != null) return `$${opt.price_override.toFixed(2)}`;
  if (opt.price_delta !== 0)
    return `${opt.price_delta > 0 ? '+' : ''}$${opt.price_delta.toFixed(2)}`;
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
  dishKind?: string;
  displayPricePrefix?: string;
  optionGroups?: OptionGroup[];
  optionAllergens?: Map<string, string[]>;
  userAllergens?: string[];
  photos: DishPhoto[];
  onPhotoAdded?: () => void;
  restaurantId?: string;
  existingOpinion?: DishOpinion | null;
  onRated?: (opinion: DishOpinion, tags: DishTag[]) => void;
}

export function DishPhotoModal({
  visible,
  onClose,
  dishId,
  dishName,
  dishDescription,
  dishPrice,
  dishKind = 'standard',
  displayPricePrefix = 'exact',
  optionGroups = [],
  optionAllergens = new Map(),
  userAllergens = [],
  photos,
  onPhotoAdded,
  restaurantId,
  existingOpinion = null,
  onRated,
}: DishPhotoModalProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const photoScrollRef = useRef<ScrollView>(null);
  const user = useAuthStore(state => state.user);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Check whether the dish is already saved when the modal opens.
  useEffect(() => {
    if (!visible || !user) {
      setIsSaved(false);
      return;
    }
    isFavorited(user.id, 'dish', dishId).then(result => {
      if (result.ok) setIsSaved(result.data);
    });
  }, [visible, dishId, user?.id]);

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
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* stopPropagation: tapping the sheet itself should not dismiss */}
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.dishName}>
                {dishName}
                {KIND_BADGE[dishKind] ?? ''}
              </Text>
              <Text style={styles.dishPrice}>
                {displayPricePrefix === 'from' &&
                  t('restaurant.price.from', { price: `$${dishPrice.toFixed(2)}` })}
                {displayPricePrefix === 'per_person' &&
                  t('restaurant.price.perPerson', { price: `$${dishPrice.toFixed(2)}` })}
                {displayPricePrefix === 'market_price' && t('restaurant.price.marketPrice')}
                {displayPricePrefix === 'ask_server' && t('restaurant.price.askServer')}
                {(!displayPricePrefix || displayPricePrefix === 'exact') &&
                  `$${dishPrice.toFixed(2)}`}
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
          >
            {/* Main Photo */}
            <View style={styles.mainPhotoContainer}>
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
                  onRated={onRated ?? (() => {})}
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
                            const optAllergens = optionAllergens.get(opt.id) ?? [];
                            const triggered =
                              userAllergens.length > 0
                                ? optAllergens.filter((a: string) => userAllergens.includes(a))
                                : [];
                            const priceLabel = formatOptionPrice(opt);
                            return (
                              <View key={opt.id} style={styles.optionListRow}>
                                <View style={styles.optionListRowMain}>
                                  <Text style={styles.optionListName}>{opt.name}</Text>
                                  {priceLabel != null && (
                                    <Text style={styles.optionPrice}>{priceLabel}</Text>
                                  )}
                                </View>
                                {triggered.length > 0 && (
                                  <Text style={styles.optionAllergenWarning}>
                                    ⚠️ {triggered.join(', ')}
                                  </Text>
                                )}
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
        </Pressable>
      </Pressable>
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
    height: '75%',
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
    flex: 1,
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
  optionAllergenWarning: {
    fontSize: typography.size.xs,
    color: colors.warning ?? '#F59E0B',
    marginTop: 2,
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
