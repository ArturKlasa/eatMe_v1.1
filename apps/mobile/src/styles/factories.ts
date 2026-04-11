/**
 * Style Factories
 *
 * Reusable factory functions for generating common style patterns.
 * These are building blocks used by all other style modules.
 */

import { TextStyle, ViewStyle } from 'react-native';
import { theme } from './theme';

const { colors, typography } = theme;

/**
 * Factory: Creates flex container variations
 */
export const createFlexContainer = (
  direction: 'row' | 'column' = 'column',
  align: 'flex-start' | 'center' | 'flex-end' | 'stretch' = 'stretch',
  justify: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' = 'flex-start'
): ViewStyle => ({
  flexDirection: direction,
  alignItems: align,
  justifyContent: justify,
});

/**
 * Factory: Creates centered containers
 */
export const createCenteredContainer = (horizontal = true, vertical = true): ViewStyle => ({
  ...(horizontal && { alignItems: 'center' }),
  ...(vertical && { justifyContent: 'center' }),
});

/**
 * Factory: Creates padding variations
 */
export const createPadding = (vertical?: number, horizontal?: number, all?: number): ViewStyle => ({
  ...(all !== undefined && { padding: all }),
  ...(vertical !== undefined && { paddingVertical: vertical }),
  ...(horizontal !== undefined && { paddingHorizontal: horizontal }),
});

/**
 * Factory: Creates border variations
 */
export const createBorder = (
  width: number,
  color: string,
  position?: 'top' | 'bottom' | 'left' | 'right'
): ViewStyle => {
  if (!position) {
    return { borderWidth: width, borderColor: color };
  }
  return {
    [`border${position.charAt(0).toUpperCase() + position.slice(1)}Width`]: width,
    [`border${position.charAt(0).toUpperCase() + position.slice(1)}Color`]: color,
  } as ViewStyle;
};

/**
 * Factory: Creates text style variations
 */
export const createTextStyle = (
  size: keyof typeof typography.size,
  weight: keyof typeof typography.weight,
  color: string,
  additionalProps?: Partial<TextStyle>
): TextStyle => ({
  fontSize: typography.size[size],
  fontWeight: typography.weight[weight],
  color,
  ...additionalProps,
});

/**
 * Factory: Creates rounded corner variations
 */
export const createRounded = (radius: number, positions?: string[]): ViewStyle => {
  if (!positions) {
    return { borderRadius: radius };
  }
  const style: Record<string, number> = {};
  positions.forEach(pos => {
    style[`border${pos}Radius`] = radius;
  });
  return style;
};

/**
 * Factory: Creates shadow variations
 */
export const createShadow = (
  elevation: number,
  shadowColor = colors.black,
  shadowOpacity = 0.25
): ViewStyle => ({
  elevation,
  shadowColor,
  shadowOpacity,
  shadowRadius: elevation,
  shadowOffset: { width: 0, height: elevation / 2 },
});
