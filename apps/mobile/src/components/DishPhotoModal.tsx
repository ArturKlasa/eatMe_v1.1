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
        <View style={styles.infoSection}>
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
              <ActivityIndicator color="#fff" size="small" />
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  dishName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  dishPrice: {
    fontSize: 16,
    color: '#FF6B35',
    marginTop: 2,
  },
  mainPhotoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#000',
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
    backgroundColor: '#2a2a2a',
  },
  noPhotoIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  noPhotoText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  noPhotoSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  photoCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  photoCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  thumbnailScroll: {
    maxHeight: 80,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  thumbnailContent: {
    padding: 12,
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailSelected: {
    borderColor: '#FF6B35',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    flex: 1,
    padding: 16,
  },
  descriptionContainer: {
    marginBottom: 16,
  },
  descriptionLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  addPhotoButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  addPhotoIcon: {
    fontSize: 24,
  },
  addPhotoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photosFromCommunity: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});
