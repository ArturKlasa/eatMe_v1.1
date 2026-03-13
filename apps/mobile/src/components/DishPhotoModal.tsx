import React, { useState } from 'react';
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
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { pickImage, takePhoto, uploadDishPhoto } from '../services/dishPhotoService';
import { colors, typography, spacing, borderRadius } from '@eatme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  dishIngredients?: string[];
  dishPrice: number;
  photos: DishPhoto[];
  onPhotoAdded?: () => void; // Callback to refresh photos after upload
}

export function DishPhotoModal({
  visible,
  onClose,
  dishId,
  dishName,
  dishDescription,
  dishIngredients,
  dishPrice,
  photos,
  onPhotoAdded,
}: DishPhotoModalProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const user = useAuthStore(state => state.user);

  const handleAddPhoto = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to upload photos');
      return;
    }

    Alert.alert('Add Photo', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: handleTakePhoto,
      },
      {
        text: 'Choose from Library',
        onPress: handlePickImage,
      },
      {
        text: 'Cancel',
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
      Alert.alert('Success', 'Photo uploaded successfully!');
      onPhotoAdded?.(); // Trigger refresh
    } else {
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    }
    setUploading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.dishName}>{dishName}</Text>
            <Text style={styles.dishPrice}>${dishPrice.toFixed(2)}</Text>
          </View>
        </View>

        {/* Main Photo */}
        <View style={styles.mainPhotoContainer}>
          {photos.length > 0 ? (
            <Image
              source={{ uri: photos[selectedPhotoIndex].photo_url }}
              style={styles.mainPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noPhotoContainer}>
              <Text style={styles.noPhotoIcon}>📸</Text>
              <Text style={styles.noPhotoText}>No photos yet</Text>
              <Text style={styles.noPhotoSubtext}>Be the first to share!</Text>
            </View>
          )}

          {/* Photo Counter */}
          {photos.length > 0 && (
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterText}>
                {selectedPhotoIndex + 1} / {photos.length}
              </Text>
            </View>
          )}
        </View>

        {/* Photo Thumbnails */}
        {photos.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailScroll}
            contentContainerStyle={styles.thumbnailContent}
          >
            {photos.map((photo, index) => (
              <TouchableOpacity
                key={photo.id}
                onPress={() => setSelectedPhotoIndex(index)}
                style={[styles.thumbnail, selectedPhotoIndex === index && styles.thumbnailSelected]}
              >
                <Image source={{ uri: photo.photo_url }} style={styles.thumbnailImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Dish Info */}
        <ScrollView
          style={styles.infoSection}
          contentContainerStyle={styles.infoSectionContent}
          showsVerticalScrollIndicator={false}
        >
          {dishDescription && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text style={styles.description}>{dishDescription}</Text>
            </View>
          )}

          {dishIngredients && dishIngredients.length > 0 && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>Ingredients</Text>
              <Text style={styles.description}>{dishIngredients.join(', ')}</Text>
            </View>
          )}

          {/* Add Photo Button */}
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={handleAddPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={styles.addPhotoText}>Add Your Photo</Text>
              </>
            )}
          </TouchableOpacity>

          {photos.length > 0 && (
            <Text style={styles.photosFromCommunity}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''} from the community
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
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
    height: SCREEN_WIDTH,
    backgroundColor: colors.black,
    position: 'relative',
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
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
    flex: 1,
    padding: spacing.base,
  },
  infoSectionContent: {
    paddingBottom: spacing.xl,
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
  addPhotoButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.md,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  addPhotoIcon: {
    fontSize: typography.size['2xl'],
  },
  addPhotoText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  photosFromCommunity: {
    fontSize: typography.size.sm,
    color: colors.darkTextMuted,
    fontStyle: 'italic',
  },
});
