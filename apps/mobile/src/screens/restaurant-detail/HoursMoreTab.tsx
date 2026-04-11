/**
 * HoursMoreTab
 *
 * Renders the "Hours & More" tab content: expandable opening hours,
 * payment methods, address, and action rows (favorites, review, share, call, report).
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { restaurantDetailStyles as styles } from '@/styles';
import { typography } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { formatOpeningHours } from '../../utils/i18nUtils';
import { type RestaurantWithMenus } from '../../lib/supabase';
import { getCurrentDayName, type PaymentNote } from './RestaurantMetadata';

interface HoursMoreTabProps {
  restaurant: RestaurantWithMenus;
  hoursExpanded: boolean;
  setHoursExpanded: (v: boolean) => void;
  todayHours: { open: string; close: string } | null;
  paymentNote: PaymentNote;
  isFavorite: boolean;
  favoriteLoading: boolean;
  favoritesInitialized: boolean;
  onShowAddressModal: () => void;
  onMenuOption: (option: string) => void;
}

export function HoursMoreTab({
  restaurant,
  hoursExpanded,
  setHoursExpanded,
  todayHours,
  paymentNote,
  isFavorite,
  favoriteLoading,
  favoritesInitialized,
  onShowAddressModal,
  onMenuOption,
}: HoursMoreTabProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      contentContainerStyle={[styles.hoursTabContent, { paddingBottom: insets.bottom + 24 }]}
    >
      {/* Opening Hours Section */}
      <View style={styles.hoursMoreSection}>
        <Text style={styles.hoursMoreSectionTitle}>{t('time.openingHours')}</Text>

        <TouchableOpacity
          style={styles.weekDayRow}
          onPress={() => setHoursExpanded(!hoursExpanded)}
          activeOpacity={0.7}
        >
          <Text style={[styles.weekDayName, { fontWeight: typography.weight.bold }]}>
            {t(`time.${getCurrentDayName().toLowerCase()}`)}
          </Text>
          {todayHours ? (
            <Text style={[styles.weekDayHours, { flex: 1 }]}>
              {formatOpeningHours(todayHours.open, todayHours.close)}
            </Text>
          ) : (
            <Text style={[styles.weekDayHoursClosed, { flex: 1 }]}>
              {t('restaurant.closed')}
            </Text>
          )}
          <Text style={styles.hoursExpandIcon}>{hoursExpanded ? '▴' : '▾'}</Text>
        </TouchableOpacity>
        {hoursExpanded && (
          <View style={styles.fullWeekHours}>
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
              .filter(day => day !== getCurrentDayName().toLowerCase())
              .map(day => {
                const hours = (
                  restaurant.open_hours as Record<
                    string,
                    { open: string; close: string }
                  > | null
                )?.[day];
                return (
                  <View key={day} style={styles.weekDayRow}>
                    <Text style={styles.weekDayName}>{t(`time.${day}`)}</Text>
                    {hours ? (
                      <Text style={styles.weekDayHours}>
                        {formatOpeningHours(hours.open, hours.close)}
                      </Text>
                    ) : (
                      <Text style={styles.weekDayHoursClosed}>{t('restaurant.closed')}</Text>
                    )}
                  </View>
                );
              })}
          </View>
        )}
      </View>

      {/* Payment Methods Section */}
      {paymentNote && (
        <View style={styles.hoursMoreSection}>
          <Text style={styles.hoursMoreSectionTitle}>{t('restaurant.paymentLabel')}</Text>
          <Text style={styles.hoursMoreAddress}>
            {paymentNote.icon}
            {'  '}
            {paymentNote.label}
          </Text>
        </View>
      )}

      {/* Address Section */}
      <View style={styles.hoursMoreSection}>
        <Text style={styles.hoursMoreSectionTitle}>{t('settings.address')}</Text>
        <Text style={styles.hoursMoreAddress}>
          {restaurant.address}
          {'\n'}
          {restaurant.city}
          {restaurant.postal_code ? `, ${restaurant.postal_code}` : ''}
        </Text>
        <TouchableOpacity
          style={styles.hoursMoreActionButton}
          onPress={onShowAddressModal}
        >
          <Text style={styles.hoursMoreActionButtonText}>📍 {t('restaurant.openInMaps')}</Text>
        </TouchableOpacity>
      </View>

      {/* More Actions Section */}
      <View style={styles.hoursMoreSection}>
        <Text style={styles.hoursMoreSectionTitle}>{t('restaurant.more')}</Text>

        <TouchableOpacity
          style={styles.hoursMoreRow}
          onPress={() => onMenuOption('favorites')}
          disabled={favoriteLoading || !favoritesInitialized}
        >
          <Text style={styles.hoursMoreRowIcon}>⭐</Text>
          <Text style={styles.hoursMoreRowText}>
            {!favoritesInitialized
              ? t('common.loading')
              : favoriteLoading
                ? t('common.updating')
                : isFavorite
                  ? t('restaurant.removeFromFavorites')
                  : t('restaurant.addToFavorites')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.hoursMoreRow}
          onPress={() => onMenuOption('review')}
        >
          <Text style={styles.hoursMoreRowIcon}>✍️</Text>
          <Text style={styles.hoursMoreRowText}>{t('restaurantDetail.addReview')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.hoursMoreRow} onPress={() => onMenuOption('share')}>
          <Text style={styles.hoursMoreRowIcon}>↗️</Text>
          <Text style={styles.hoursMoreRowText}>{t('restaurant.share')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.hoursMoreRow} onPress={() => onMenuOption('call')}>
          <Text style={styles.hoursMoreRowIcon}>📞</Text>
          <Text style={styles.hoursMoreRowText}>{t('restaurant.call')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.hoursMoreRow, styles.hoursMoreRowLast]}
          onPress={() => onMenuOption('report')}
        >
          <Text style={styles.hoursMoreRowIcon}>🚩</Text>
          <Text style={[styles.hoursMoreRowText, styles.hoursMoreRowTextDanger]}>
            {t('restaurant.reportMisleadingInfo')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
