/**
 * Dish Photo Service
 *
 * Handles uploading and managing dish photos
 */

import { supabase } from '../lib/supabase';
import { uploadPhoto } from './ratingService';
import * as ImagePicker from 'expo-image-picker';

export interface DishPhoto {
  id: string;
  dish_id: string;
  user_id: string;
  photo_url: string;
  created_at: string;
}

/**
 * Request camera/photo library permissions
 */
export async function requestPhotoPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Pick an image from the library
 */
export async function pickImage(): Promise<string | null> {
  try {
    const hasPermission = await requestPhotoPermissions();
    if (!hasPermission) {
      console.log('[DishPhoto] Permission denied');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7, // Compress to reduce file size
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }

    return null;
  } catch (error) {
    console.error('[DishPhoto] Error picking image:', error);
    return null;
  }
}

/**
 * Take a photo with camera
 */
export async function takePhoto(): Promise<string | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.log('[DishPhoto] Camera permission denied');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }

    return null;
  } catch (error) {
    console.error('[DishPhoto] Error taking photo:', error);
    return null;
  }
}

/**
 * Upload dish photo and save to database
 */
export async function uploadDishPhoto(
  userId: string,
  dishId: string,
  photoUri: string
): Promise<{ success: boolean; photoId?: string; photoUrl?: string }> {
  try {
    console.log('[DishPhoto] Uploading photo for dish:', dishId);

    // Upload to Supabase Storage
    const photoUrl = await uploadPhoto(photoUri, 'dish', userId);
    if (!photoUrl) {
      return { success: false };
    }

    console.log('[DishPhoto] Photo uploaded to storage:', photoUrl);

    // Save to database
    const { data, error } = await supabase
      .from('dish_photos')
      .insert({
        user_id: userId,
        dish_id: dishId,
        photo_url: photoUrl,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[DishPhoto] Error saving to database:', error);
      return { success: false };
    }

    console.log('[DishPhoto] Photo saved to database:', data.id);
    return { success: true, photoId: data.id, photoUrl };
  } catch (error) {
    console.error('[DishPhoto] Error in uploadDishPhoto:', error);
    return { success: false };
  }
}

/**
 * Get photos for a dish
 */
export async function getDishPhotos(dishId: string): Promise<DishPhoto[]> {
  try {
    const { data, error } = await supabase
      .from('dish_photos')
      .select('*')
      .eq('dish_id', dishId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DishPhoto] Error fetching photos:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[DishPhoto] Error in getDishPhotos:', error);
    return [];
  }
}
