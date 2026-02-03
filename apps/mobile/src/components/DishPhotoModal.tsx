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
} from 'react-native';

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
  dishName: string;
  dishDescription?: string;
  dishPrice: number;
  photos: DishPhoto[];
}

export function DishPhotoModal({
  visible,
  onClose,
  dishName,
  dishDescription,
  dishPrice,
  photos,
}: DishPhotoModalProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

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
  photosFromCommunity: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});
