import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { EatTogetherScreenProps } from '@/types/navigation';
import { modalScreenStyles } from '@/styles';
import { useAuthStore } from '../stores/authStore';

/**
 * EatTogetherScreen Component
 *
 * Main entry screen for group dining features.
 * Allows users to create or join Eat Together sessions.
 */
export function EatTogetherScreen({ navigation }: EatTogetherScreenProps) {
  const { t } = useTranslation();
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);
  const user = useAuthStore(state => state.user);

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

  const handleScroll = (event: any) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  };

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
          <Text style={modalScreenStyles.title}>{t('eatTogether.title')}</Text>
          <Text style={modalScreenStyles.subtitle}>{t('eatTogether.subtitle')}</Text>
        </View>

        <ScrollView
          style={modalScreenStyles.scrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {user ? (
            <>
              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={() => navigation.navigate('CreateSession' as any)}
                >
                  <Text style={styles.actionIcon}>🎯</Text>
                  <Text style={styles.actionTitle}>{t('eatTogether.startSession')}</Text>
                  <Text style={styles.actionDescription}>{t('eatTogether.startDescription')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => navigation.navigate('JoinSession' as any)}
                >
                  <Text style={styles.actionIcon}>🔗</Text>
                  <Text style={styles.actionTitle}>{t('eatTogether.joinSession')}</Text>
                  <Text style={styles.actionDescription}>{t('eatTogether.joinDescription')}</Text>
                </TouchableOpacity>
              </View>

              {/* How It Works */}
              <View style={modalScreenStyles.section}>
                <Text style={modalScreenStyles.sectionTitle}>
                  {t('eatTogether.howItWorksTitle')}
                </Text>
                <View style={styles.stepsList}>
                  {[
                    { icon: '1️⃣', text: t('eatTogether.step1') },
                    { icon: '2️⃣', text: t('eatTogether.step2') },
                    { icon: '3️⃣', text: t('eatTogether.step3') },
                    { icon: '4️⃣', text: t('eatTogether.step4') },
                    { icon: '5️⃣', text: t('eatTogether.step5') },
                  ].map((step, index) => (
                    <View key={index} style={styles.stepItem}>
                      <Text style={styles.stepIcon}>{step.icon}</Text>
                      <Text style={styles.stepText}>{step.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            /* Not Signed In */
            <View style={modalScreenStyles.emptyState}>
              <Text style={modalScreenStyles.emptyIcon}>🔒</Text>
              <Text style={modalScreenStyles.emptyTitle}>{t('common.signInRequired')}</Text>
              <Text style={modalScreenStyles.emptyDescription}>
                {t('eatTogether.signInMessage')}
              </Text>
            </View>
          )}

          {/* Planned Features */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>{t('eatTogether.features')}</Text>
            <View style={modalScreenStyles.sectionContent}>
              {[
                t('eatTogether.feature1'),
                t('eatTogether.feature2'),
                t('eatTogether.feature3'),
                t('eatTogether.feature4'),
                t('eatTogether.feature5'),
                t('eatTogether.feature6'),
              ].map((feature, index) => (
                <View key={index} style={modalScreenStyles.featureItem}>
                  <Text style={modalScreenStyles.featureBullet}>•</Text>
                  <Text style={modalScreenStyles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Info Section */}
          <View style={modalScreenStyles.section}>
            <Text style={modalScreenStyles.sectionTitle}>{t('eatTogether.futureTitle')}</Text>
            <View style={modalScreenStyles.sectionContent}>
              <View style={modalScreenStyles.featureItem}>
                <Text style={modalScreenStyles.featureBullet}>1.</Text>
                <Text style={modalScreenStyles.featureText}>{t('eatTogether.future1')}</Text>
              </View>
              <View style={modalScreenStyles.featureItem}>
                <Text style={modalScreenStyles.featureBullet}>2.</Text>
                <Text style={modalScreenStyles.featureText}>{t('eatTogether.future2')}</Text>
              </View>
              <View style={modalScreenStyles.featureItem}>
                <Text style={modalScreenStyles.featureBullet}>3.</Text>
                <Text style={modalScreenStyles.featureText}>{t('eatTogether.future3')}</Text>
              </View>
              <View style={modalScreenStyles.featureItem}>
                <Text style={modalScreenStyles.featureBullet}>4.</Text>
                <Text style={modalScreenStyles.featureText}>{t('eatTogether.future4')}</Text>
              </View>
            </View>
          </View>

          <View style={modalScreenStyles.bottomSpacer} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  primaryAction: {
    backgroundColor: '#FF9800',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryAction: {
    backgroundColor: '#2A2A2A',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  actionIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  actionTitle: {
    color: '#E0E0E0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  actionDescription: {
    color: '#E0E0E0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  stepIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  stepText: {
    color: '#E0E0E0',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});

export default EatTogetherScreen;
