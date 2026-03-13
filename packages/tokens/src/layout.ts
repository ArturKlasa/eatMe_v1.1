/**
 * EatMe Design System — Layout Tokens
 */

export const layout = {
  headerHeight: 60,
  headerPaddingTop: 50,
  headerPaddingBottom: 20,
  headerPaddingHorizontal: 20,

  screenPadding: 20,
  sectionPadding: 20,

  avatarSize: 80,
  iconSize: 24,
  buttonHeight: 48,
  inputHeight: 48,
} as const;

export type Layout = typeof layout;
