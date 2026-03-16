import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { styles } from './RegisterScreen.styles';
import { colors } from '@eatme/tokens';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from '../../types/navigation';
import { GoogleIcon, FacebookIcon } from '../../components/icons';
import { AuthLanguageSelector } from '../../components/auth';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

export function RegisterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { signUp, signInWithOAuth, isLoading, error, clearError } = useAuthStore();

  const [profileName, setProfileName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleOAuthSignIn = async (provider: 'google' | 'facebook') => {
    setOauthLoading(true);
    const { error } = await signInWithOAuth(provider);
    setOauthLoading(false);
    if (error && error.message !== 'OAuth cancelled') {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const isButtonDisabled = isLoading || oauthLoading;

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return t('register.passwordTooShort');
    }
    if (!/[A-Z]/.test(pwd)) {
      return t('register.passwordNeedsUppercase');
    }
    if (!/[a-z]/.test(pwd)) {
      return t('register.passwordNeedsLowercase');
    }
    if (!/[0-9]/.test(pwd)) {
      return t('register.passwordNeedsNumber');
    }
    return null;
  };

  const handleRegister = async () => {
    // Validate inputs
    if (!profileName.trim()) {
      Alert.alert(t('auth.error'), t('register.profileNameRequired'));
      return;
    }

    if (profileName.trim().length < 3) {
      Alert.alert(t('auth.error'), t('register.profileNameTooShort'));
      return;
    }

    if (profileName.trim().length > 12) {
      Alert.alert(t('auth.error'), t('register.profileNameTooLong'));
      return;
    }

    if (!email.trim()) {
      Alert.alert(t('auth.error'), t('register.emailRequired'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert(t('auth.error'), t('register.emailInvalid'));
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Error', passwordError);
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('auth.error'), t('register.passwordMismatch'));
      return;
    }

    if (!agreeToTerms) {
      Alert.alert(t('auth.error'), t('register.termsRequired'));
      return;
    }

    clearError();
    const { error, needsEmailVerification } = await signUp(email.trim(), password, {
      profile_name: profileName.trim(),
    });

    if (error) {
      Alert.alert(t('register.registrationFailed'), error.message);
    } else if (needsEmailVerification) {
      Alert.alert(t('register.verifyEmail'), t('register.verifyEmailMessage'), [
        {
          text: t('common.ok'),
          onPress: () => navigation.navigate('Login'),
        },
      ]);
    }
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const getPasswordStrength = (): { strength: string; color: string; width: string } => {
    if (password.length === 0) {
      return { strength: '', color: colors.gray200, width: '0%' };
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2)
      return { strength: t('register.passwordWeak'), color: colors.error, width: '33%' };
    if (score <= 4)
      return { strength: t('register.passwordMedium'), color: colors.warning, width: '66%' };
    return { strength: t('register.passwordStrong'), color: colors.success, width: '100%' };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Language Selector */}
          <AuthLanguageSelector />

          {/* Header */}
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>← {t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('register.title')}</Text>
            <Text style={styles.subtitle}>{t('register.subtitle')}</Text>
          </View>

          {/* Registration Form */}
          <View style={styles.formContainer}>
            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('register.profileName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('register.profileNamePlaceholder')}
                placeholderTextColor={colors.gray500}
                value={profileName}
                onChangeText={setProfileName}
                autoCapitalize="none"
                maxLength={12}
                editable={!isLoading}
              />
              <Text style={styles.inputHint}>{t('register.profileNameHint')}</Text>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('register.emailPlaceholder')}
                placeholderTextColor={colors.gray500}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={t('register.passwordPlaceholder')}
                  placeholderTextColor={colors.gray500}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.showPasswordButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.showPasswordText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarBackground}>
                    <View
                      style={[
                        styles.strengthBar,
                        {
                          width: passwordStrength.width as `${number}%`,
                          backgroundColor: passwordStrength.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                    {passwordStrength.strength}
                  </Text>
                </View>
              )}

              <Text style={styles.passwordHint}>{t('register.passwordRequirements')}</Text>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
              <TextInput
                style={[
                  styles.input,
                  confirmPassword.length > 0 && confirmPassword !== password && styles.inputError,
                ]}
                placeholder={t('register.confirmPasswordPlaceholder')}
                placeholderTextColor={colors.gray500}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <Text style={styles.errorHint}>{t('register.passwordMismatch')}</Text>
              )}
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAgreeToTerms(!agreeToTerms)}
            >
              <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                {agreeToTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                {t('register.agreeToTerms')}{' '}
                <Text style={styles.termsLink}>{t('register.termsOfService')}</Text>{' '}
                {t('common.and')}{' '}
                <Text style={styles.termsLink}>{t('register.privacyPolicy')}</Text>
              </Text>
            </TouchableOpacity>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.registerButtonText}>{t('register.createAccount')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t('common.or')}</Text>
            <View style={styles.divider} />
          </View>

          {/* Social Sign Up Buttons */}
          <View style={styles.formContainer}>
            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton]}
              onPress={() => handleOAuthSignIn('google')}
              disabled={isButtonDisabled}
            >
              {oauthLoading ? (
                <ActivityIndicator color="#4285F4" />
              ) : (
                <>
                  <GoogleIcon />
                  <Text style={styles.googleButtonText}>{t('register.continueWithGoogle')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.facebookButton]}
              onPress={() => handleOAuthSignIn('facebook')}
              disabled={isButtonDisabled}
            >
              {oauthLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <FacebookIcon />
                  <Text style={styles.facebookButtonText}>
                    {t('register.continueWithFacebook')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>{t('register.alreadyHaveAccount')} </Text>
            <TouchableOpacity onPress={handleLogin}>
              <Text style={styles.loginLink}>{t('register.signIn')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
