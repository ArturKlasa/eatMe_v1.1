import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from '../../types/navigation';
import { getSupportedLanguages, changeLanguage } from '../../i18n';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

export function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { signUp, isLoading, error, clearError } = useAuthStore();

  const [profileName, setProfileName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const supportedLanguages = getSupportedLanguages();
  const currentLanguage = i18n.language;

  const handleLanguageChange = async (languageCode: 'en' | 'es' | 'pl') => {
    await changeLanguage(languageCode);
    setShowLanguageSelector(false);
  };

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
      return { strength: '', color: '#E5E7EB', width: '0%' };
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { strength: t('register.passwordWeak'), color: '#EF4444', width: '33%' };
    if (score <= 4)
      return { strength: t('register.passwordMedium'), color: '#F59E0B', width: '66%' };
    return { strength: t('register.passwordStrong'), color: '#10B981', width: '100%' };
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
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setShowLanguageSelector(!showLanguageSelector)}
          >
            <Text style={styles.languageButtonText}>
              {supportedLanguages.find(lang => lang.code === currentLanguage)?.flag} {supportedLanguages.find(lang => lang.code === currentLanguage)?.name}
            </Text>
          </TouchableOpacity>

          {showLanguageSelector && (
            <View style={styles.languagePicker}>
              {supportedLanguages.map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    currentLanguage === lang.code && styles.languageOptionActive,
                  ]}
                  onPress={() => handleLanguageChange(lang.code as 'en' | 'es' | 'pl')}
                >
                  <Text style={styles.languageOptionText}>
                    {lang.flag} {lang.name}
                  </Text>
                  {currentLanguage === lang.code && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

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
                placeholderTextColor="#9CA3AF"
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
                placeholderTextColor="#9CA3AF"
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
                  placeholderTextColor="#9CA3AF"
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
                placeholderTextColor="#9CA3AF"
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
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>{t('register.createAccount')}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A', // dark
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  headerContainer: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: '#FF9800', // accent
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E0E0E0', // darkText
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0', // darkTextSecondary
  },
  formContainer: {
    backgroundColor: '#2A2A2A', // darkSecondary
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333333', // darkBorder
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E0E0E0', // darkText
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#333333', // darkTertiary
    borderWidth: 1,
    borderColor: '#444444', // darkBorderLight
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#E0E0E0', // darkText
  },
  inputHint: {
    fontSize: 12,
    color: '#999999', // darkTextMuted
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputError: {
    borderColor: '#FF5722', // danger
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333', // darkTertiary
    borderWidth: 1,
    borderColor: '#444444', // darkBorderLight
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#E0E0E0', // darkText
  },
  showPasswordButton: {
    padding: 16,
  },
  showPasswordText: {
    fontSize: 18,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  strengthBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: '#4A4A4A', // darkQuaternary
    borderRadius: 2,
    marginRight: 8,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
    width: 60,
  },
  passwordHint: {
    fontSize: 12,
    color: '#999999', // darkTextMuted
    marginTop: 4,
  },
  errorHint: {
    fontSize: 12,
    color: '#FF5722', // danger
    marginTop: 4,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#555555', // darkDisabled
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333', // darkDisabledBg
  },
  checkboxChecked: {
    backgroundColor: '#FF9800', // accent
    borderColor: '#FF9800', // accent
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#B0B0B0', // darkTextSecondary
    lineHeight: 20,
  },
  termsLink: {
    color: '#FF9800', // accent
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#4A2A2A', // dark red background
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF5722', // danger
  },
  errorText: {
    color: '#FF5722', // danger
    fontSize: 14,
    textAlign: 'center',
  },
  registerButton: {
    backgroundColor: '#FF9800', // accent
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#555555', // darkDisabled
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  loginText: {
    color: '#B0B0B0', // darkTextSecondary
    fontSize: 14,
  },
  loginLink: {
    color: '#FF9800', // accent
    fontSize: 14,
    fontWeight: '600',
  },
  languageButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  languageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  languagePicker: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  languageOptionActive: {
    backgroundColor: '#3A3A3A',
  },
  languageOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  checkmark: {
    color: '#FF9800',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
