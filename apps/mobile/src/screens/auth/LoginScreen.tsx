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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from '../../types/navigation';
import Svg, { Path, G } from 'react-native-svg';
import { getSupportedLanguages, changeLanguage } from '../../i18n';

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

// Google Logo SVG Component
const GoogleIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </Svg>
);

// Facebook Logo SVG Component
const FacebookIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24">
    <Path
      fill="#FFFFFF"
      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
    />
  </Svg>
);

export function LoginScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { signIn, signInWithOAuth, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const supportedLanguages = getSupportedLanguages();
  const currentLanguage = i18n.language;

  const handleLanguageChange = async (languageCode: 'en' | 'es' | 'pl') => {
    await changeLanguage(languageCode);
    setShowLanguageSelector(false);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('login.enterCredentials'));
      return;
    }

    clearError();
    const { error } = await signIn(email.trim(), password);

    if (error) {
      Alert.alert(t('login.failed'), error.message);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'facebook') => {
    clearError();
    setOauthLoading(true);

    const { error } = await signInWithOAuth(provider);

    setOauthLoading(false);

    if (error) {
      if (error.message !== 'OAuth cancelled') {
        Alert.alert(t('login.authFailed'), `${t('login.oauthError')} ${error.message}`);
      }
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const handleSignUp = () => {
    navigation.navigate('Register');
  };

  const isButtonDisabled = isLoading || oauthLoading;

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

          {/* Logo/Brand */}
          <View style={styles.headerContainer}>
            <Text style={styles.logo}>🍽️</Text>
            <Text style={styles.title}>{t('app.name')}</Text>
            <Text style={styles.subtitle}>{t('app.tagline')}</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('login.emailPlaceholder')}
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
                  placeholder={t('login.passwordPlaceholder')}
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
            </View>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isButtonDisabled && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isButtonDisabled}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>{t('login.signIn')}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>{t('common.or')}</Text>
              <View style={styles.divider} />
            </View>

            {/* Social Login Buttons */}
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
                  <Text style={styles.googleButtonText}>{t('login.continueWithGoogle')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.facebookButton]}
              onPress={() => handleOAuthSignIn('facebook')}
              disabled={isButtonDisabled}
            >
              {oauthLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <FacebookIcon />
                  <Text style={styles.facebookButtonText}>{t('login.continueWithFacebook')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>{t('login.noAccount')}</Text>
            <TouchableOpacity onPress={handleSignUp}>
              <Text style={styles.signUpLink}>{t('login.signUp')}</Text>
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
    padding: 16,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  logo: {
    fontSize: 48,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FF9800', // accent
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0', // darkTextSecondary
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: '#2A2A2A', // darkSecondary
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333333', // darkBorder
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#E0E0E0', // darkText
    marginBottom: 24,
    textAlign: 'center',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: '#FF9800', // accent
    fontSize: 14,
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
  loginButton: {
    backgroundColor: '#FF9800', // accent
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#555555', // darkDisabled
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#444444', // darkBorderLight
  },
  dividerText: {
    color: '#999999', // darkTextMuted
    paddingHorizontal: 16,
    fontSize: 14,
  },
  socialButton: {
    backgroundColor: '#333333', // darkTertiary
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444444', // darkBorderLight
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DADCE0',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  socialButtonText: {
    color: '#B0B0B0', // darkTextSecondary
    fontSize: 16,
    fontWeight: '500',
  },
  googleButtonText: {
    color: '#3C4043',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  facebookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  signUpText: {
    color: '#B0B0B0', // darkTextSecondary
    fontSize: 14,
  },
  signUpLink: {
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
