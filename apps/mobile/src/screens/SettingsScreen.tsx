import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  Switch,
  Modal,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SettingsScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';
import { colors, spacing, typography, borderRadius } from '@eatme/tokens';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useSettingsStore } from '@/stores/settingsStore';
import { getSupportedLanguages } from '@/i18n';

/**
 * SettingsScreen Component
 *
 * App settings and preferences screen with language selection,
 * notifications, location, and other user preferences.
 */
export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const { language, pushNotifications, locationServices, updateNotifications, updatePrivacy } =
    useSettingsStore();

  const translateY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);

  const supportedLanguages = getSupportedLanguages();
  const currentLanguageData = supportedLanguages.find(lang => lang.code === language);

  useFocusEffect(
    React.useCallback(() => {
      translateY.setValue(0);
      scrollOffsetY.current = 0;
    }, [translateY])
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return scrollOffsetY.current <= 0 && gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (scrollOffsetY.current <= 0 && gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          navigation.navigate('Map');
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  };

  const handleLanguageChange = () => {
    // Language has been changed successfully via LanguageSelector
    setShowLanguageModal(false);
  };

  const comingSoonFeatures = [
    t('settings.accountManagement') || 'Account management',
    t('settings.dietaryPreferences') || 'Dietary preferences setup',
    t('settings.units'),
    t('settings.themeCustomization') || 'Theme customization',
    t('settings.backupSync') || 'Backup & sync',
  ];

  return (
    <View style={modalScreenStyles.container}>
      <TouchableOpacity
        style={modalScreenStyles.overlay}
        activeOpacity={1}
        onPress={() => navigation.navigate('Map')}
      />
      <Animated.View
        style={[
          modalScreenStyles.modalContainer,
          {
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={modalScreenStyles.dragHandle} />

        <View style={modalScreenStyles.header}>
          <Text style={modalScreenStyles.title}>{t('settings.title')}</Text>
          <Text style={modalScreenStyles.subtitle}>{t('settings.subtitle')}</Text>
        </View>

        <ScrollView
          style={modalScreenStyles.scrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Language & Localization */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>{t('settings.language')}</Text>

            <TouchableOpacity
              style={modalScreenStyles.settingItem}
              onPress={() => setShowLanguageModal(true)}
              activeOpacity={0.7}
            >
              <View style={modalScreenStyles.settingContent}>
                <Text style={modalScreenStyles.settingLabel}>{t('settings.language')}</Text>
                <Text style={modalScreenStyles.settingDescription}>
                  {t('settings.languageDescription')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontSize: 20 }}>{currentLanguageData?.flag}</Text>
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: typography.size.base,
                    fontWeight: typography.weight.semibold,
                  }}
                >
                  {currentLanguageData?.name}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* App Preferences */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>{t('settings.appPreferences')}</Text>

            <View style={modalScreenStyles.settingItem}>
              <View style={modalScreenStyles.settingContent}>
                <Text style={modalScreenStyles.settingLabel}>
                  {t('settings.pushNotifications')}
                </Text>
                <Text style={modalScreenStyles.settingDescription}>
                  {t('settings.pushNotificationsDescription')}
                </Text>
              </View>
              <Switch
                value={pushNotifications}
                onValueChange={value => updateNotifications({ pushNotifications: value })}
                trackColor={{ false: colors.darkDragHandle, true: colors.accent }}
                thumbColor={pushNotifications ? colors.white : colors.gray400}
              />
            </View>

            <View style={modalScreenStyles.settingItem}>
              <View style={modalScreenStyles.settingContent}>
                <Text style={modalScreenStyles.settingLabel}>{t('settings.locationServices')}</Text>
                <Text style={modalScreenStyles.settingDescription}>
                  {t('settings.locationServicesDescription')}
                </Text>
              </View>
              <Switch
                value={locationServices}
                onValueChange={value => updatePrivacy({ locationServices: value })}
                trackColor={{ false: colors.darkDragHandle, true: colors.accent }}
                thumbColor={locationServices ? colors.white : colors.gray400}
              />
            </View>
          </View>

          {/* Data & Privacy */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>{t('settings.dataAndPrivacy')}</Text>

            <TouchableOpacity style={modalScreenStyles.actionItem}>
              <Text style={modalScreenStyles.actionText}>{t('settings.clearSearchHistory')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={modalScreenStyles.actionItem}>
              <Text style={modalScreenStyles.actionText}>{t('settings.exportMyData')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={modalScreenStyles.actionItem}>
              <Text style={modalScreenStyles.actionText}>{t('settings.privacyPolicy')}</Text>
            </TouchableOpacity>
          </View>

          {/* About */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>{t('settings.about')}</Text>
            <View style={modalScreenStyles.aboutContent}>
              <Text style={modalScreenStyles.aboutText}>
                {t('app.name')} - {t('app.description')}
              </Text>
              <Text style={modalScreenStyles.aboutText}>{t('app.versionBeta')}</Text>
              <Text style={modalScreenStyles.aboutText}>{t('app.phase1')}</Text>
            </View>
          </View>

          {/* Coming Soon */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>{t('settings.comingSoon')}</Text>
            <View style={modalScreenStyles.sectionContent}>
              {comingSoonFeatures.map((feature, index) => (
                <View key={index} style={modalScreenStyles.featureItem}>
                  <Text style={modalScreenStyles.featureBullet}>•</Text>
                  <Text style={modalScreenStyles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: Math.max(40, insets.bottom + 20) }} />
        </ScrollView>

        {/* Language Selector Modal */}
        <Modal
          visible={showLanguageModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowLanguageModal(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              justifyContent: 'flex-end',
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowLanguageModal(false)}
            />
            <View
              style={{
                backgroundColor: colors.dark,
                borderTopLeftRadius: borderRadius['2xl'],
                borderTopRightRadius: borderRadius['2xl'],
                paddingBottom: Math.max(40, insets.bottom + 20),
              }}
            >
              <LanguageSelector onLanguageChange={handleLanguageChange} />
              <TouchableOpacity
                style={{
                  backgroundColor: colors.accent,
                  marginHorizontal: spacing.base,
                  marginTop: spacing.base,
                  padding: spacing.base,
                  borderRadius: borderRadius.md,
                  alignItems: 'center',
                }}
                onPress={() => setShowLanguageModal(false)}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontSize: typography.size.base,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </View>
  );
}

export default SettingsScreen;
