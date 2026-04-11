/**
 * AddressModal
 *
 * Modal overlay that displays the restaurant address and offers
 * a button to open the location in Google Maps.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, Alert, Linking } from 'react-native';
import { restaurantDetailStyles as styles } from '@/styles';
import { useTranslation } from 'react-i18next';

interface AddressModalProps {
  visible: boolean;
  address: string;
  city: string | null;
  postalCode: string | null | undefined;
  onClose: () => void;
}

export function AddressModal({ visible, address, city, postalCode, onClose }: AddressModalProps) {
  const { t } = useTranslation();

  const handleOpenMaps = () => {
    const fullAddress = `${address}, ${city}, ${postalCode}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    Linking.openURL(url).catch(err => {
      console.error('Failed to open maps:', err);
      Alert.alert(t('common.error'), 'Failed to open maps');
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.addressModalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.addressModal}>
          <Text style={styles.addressModalTitle}>{t('restaurant.restaurantAddress')}</Text>
          <Text style={styles.addressModalText}>
            {address}
            {'\n'}
            {city}, {postalCode}
          </Text>
          <View style={styles.addressModalButtons}>
            <TouchableOpacity
              style={[styles.addressModalButton, styles.addressModalButtonPrimary]}
              onPress={handleOpenMaps}
            >
              <Text style={styles.addressModalButtonText}>{t('restaurant.openInMaps')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addressModalButton}
              onPress={onClose}
            >
              <Text
                style={[styles.addressModalButtonText, styles.addressModalButtonTextSecondary]}
              >
                {t('common.close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
