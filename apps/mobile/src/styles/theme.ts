/**
 * Design System Theme
 *
 * Centralized theme configuration for colors, typography, spacing, and other design tokens.
 * Used throughout the app to maintain consistency and enable easy theming.
 */

export const colors = {
  // Primary Colors
  primary: '#007AFF',
  primaryDark: '#0056CC',
  primaryLight: '#4DA2FF',

  // Status Colors
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',

  // Neutral Colors
  white: '#FFFFFF',
  black: '#000000',

  // Gray Scale
  gray50: '#F8F9FA',
  gray100: '#F0F0F0',
  gray200: '#E9ECEF',
  gray300: '#E0E0E0',
  gray400: '#CED4DA',
  gray500: '#ADB5BD',
  gray600: '#6C757D',
  gray700: '#495057',
  gray800: '#343A40',
  gray900: '#212529',

  // Text Colors
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textInverse: '#FFFFFF',

  // Background Colors
  background: '#FFFFFF',
  backgroundSecondary: '#F8F9FA',
  backgroundTertiary: '#F9F9F9',

  // Border Colors
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  borderDark: '#CED4DA',

  // Map Colors
  mapMarkerOpen: '#4CAF50',
  mapMarkerClosed: '#F44336',

  // Dark Theme Colors (for modals, overlays, and dark mode components)
  dark: '#1A1A1A', // Main dark background
  darkSecondary: '#2A2A2A', // Secondary dark background
  darkTertiary: '#333333', // Tertiary dark background
  darkQuaternary: '#4A4A4A', // Light dark background (for buttons, options)
  darkBorder: '#333333', // Dark border color
  darkBorderLight: '#444444', // Lighter dark border
  darkBorderDark: '#2A2A2A', // Darker border
  darkText: '#E0E0E0', // Primary text on dark
  darkTextSecondary: '#B0B0B0', // Secondary text on dark
  darkTextMuted: '#999999', // Muted text on dark
  darkTextLight: '#CCCCCC', // Light text on dark
  darkDragHandle: '#666666', // Drag handle color
  darkDisabled: '#555555', // Disabled elements border
  darkDisabledBg: '#333333', // Disabled elements background
  darkDisabledText: '#666666', // Disabled text color

  // Accent Colors (used across light and dark themes)
  accent: '#FF9800', // Orange accent (primary CTA)
  accentDark: '#F57C00', // Darker orange
  accentLight: '#FFB74D', // Lighter orange
  danger: '#FF5722', // Red for dangerous/unavailable items
} as const;

export const typography = {
  // Font Sizes
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
    '6xl': 48,
    '7xl': 64,
  },

  // Font Weights
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
    loose: 2,
  },
} as const;

export const spacing = {
  // Base spacing unit (4px)
  unit: 4,

  // Spacing scale
  xs: 4, // 1 unit
  sm: 8, // 2 units
  md: 12, // 3 units
  base: 16, // 4 units
  lg: 20, // 5 units
  xl: 24, // 6 units
  '2xl': 32, // 8 units
  '3xl': 40, // 10 units
  '4xl': 48, // 12 units
  '5xl': 64, // 16 units
  '6xl': 80, // 20 units
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const layout = {
  // Screen header configuration
  headerHeight: 60,
  headerPaddingTop: 50,
  headerPaddingBottom: 20,
  headerPaddingHorizontal: 20,

  // Container configurations
  screenPadding: 20,
  sectionPadding: 20,

  // Component sizes
  avatarSize: 80,
  iconSize: 24,
  buttonHeight: 48,
  inputHeight: 48,
} as const;

// Export combined theme object
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
} as const;

// Type definitions for theme
export type Theme = typeof theme;
export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
