/**
 * Style System Index
 *
 * Central export for all styling utilities, theme, and common styles.
 */

// Theme and design tokens
export { theme, colors, typography, spacing, borderRadius, shadows, layout } from './theme';
export type { Theme, Colors, Typography, Spacing } from './theme';

// Common/foundational styles
export {
  commonStyles as commonStylesBase,
  containers,
  headers,
  text,
  emptyState,
  cards,
  forms,
  profile,
  buttons,
  inputs,
  spacingUtils,
  switchConfig,
  modals,
  modalScreenStyles,
  viewModeToggleStyles,
  // Also export factory functions and patterns that other files use
  atomic,
  filterBase,
  buttonBase,
  createBorder,
  createTextStyle,
  createRounded,
  createShadow,
} from './common';

// Feature-specific style modules
export {
  filterStyles,
  filterComponentsStyles,
  drawerFiltersStyles,
  filterFABStyles,
} from './filters';
export { mapStylesExport, mapStyles, mapFooterStyles, mapComponentStyles } from './map';
export { navigationStyles, floatingMenuStyles, fabs } from './navigation';
export { restaurantDetailStyles } from './restaurantDetail';

// Import for creating backward-compatible commonStyles
import { commonStyles as commonStylesBase } from './common';
import { mapStyles, mapFooterStyles, mapComponentStyles } from './map';
import { filterComponentsStyles, drawerFiltersStyles, filterFABStyles } from './filters';
import { floatingMenuStyles, fabs as fabsStyles } from './navigation';

// Create backward-compatible commonStyles that includes all moved styles
export const commonStyles = {
  ...commonStylesBase,
  mapStyles,
  mapFooterStyles,
  mapComponentStyles,
  filterComponentsStyles,
  drawerFiltersStyles,
  filterFABStyles,
  floatingMenuStyles,
  fabs: fabsStyles,
};
