/**
 * EatMe Design System — Color Tokens
 *
 * Platform-agnostic color values shared across mobile (React Native)
 * and web (Next.js / CSS custom properties).
 *
 * Usage — React Native:
 *   import { colors } from '@eatme/tokens';
 *
 * Usage — Web (CSS variables generated separately in globals.css):
 *   var(--color-accent)
 */

export const colors = {
  // ─── Primary ─────────────────────────────────────────────────────────────
  primary: '#007AFF',
  primaryDark: '#0056CC',
  primaryLight: '#4DA2FF',

  // ─── Status ──────────────────────────────────────────────────────────────
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',

  // ─── Neutral ─────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',

  // ─── Gray Scale ──────────────────────────────────────────────────────────
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

  // ─── Text ────────────────────────────────────────────────────────────────
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textInverse: '#FFFFFF',

  // ─── Background ──────────────────────────────────────────────────────────
  background: '#FFFFFF',
  backgroundSecondary: '#F8F9FA',
  backgroundTertiary: '#F9F9F9',

  // ─── Border ──────────────────────────────────────────────────────────────
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  borderDark: '#CED4DA',

  // ─── Map ─────────────────────────────────────────────────────────────────
  mapMarkerOpen: '#4CAF50',
  mapMarkerClosed: '#F44336',

  // ─── Dark Theme ──────────────────────────────────────────────────────────
  /** Main dark background */
  dark: '#1A1A1A',
  /** Secondary dark background */
  darkSecondary: '#2A2A2A',
  /** Tertiary dark background */
  darkTertiary: '#333333',
  /** Light dark background (for buttons, options) */
  darkQuaternary: '#4A4A4A',
  /** Dark border */
  darkBorder: '#333333',
  /** Lighter dark border */
  darkBorderLight: '#444444',
  /** Darker border */
  darkBorderDark: '#2A2A2A',
  /** Primary text on dark */
  darkText: '#E0E0E0',
  /** Secondary text on dark */
  darkTextSecondary: '#B0B0B0',
  /** Muted text on dark */
  darkTextMuted: '#999999',
  /** Light text on dark */
  darkTextLight: '#CCCCCC',
  /** Drag handle color */
  darkDragHandle: '#666666',
  /** Disabled elements border */
  darkDisabled: '#555555',
  /** Disabled elements background */
  darkDisabledBg: '#333333',
  /** Disabled text */
  darkDisabledText: '#666666',

  // ─── Accent ──────────────────────────────────────────────────────────────
  /** Orange accent — primary CTA, used across light and dark themes */
  accent: '#FF9800',
  accentDark: '#F57C00',
  accentLight: '#FFB74D',
  /** Red for dangerous / unavailable items */
  danger: '#FF5722',
} as const;

export type Colors = typeof colors;
