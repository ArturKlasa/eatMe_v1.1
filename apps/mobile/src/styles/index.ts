/**
 * Style System Index
 *
 * Central export for all styling utilities, theme, and common styles.
 */

// Theme and design tokens
export { theme, colors, typography, spacing, borderRadius, shadows, layout } from './theme';
export type { Theme, Colors, Typography, Spacing } from './theme';

// Factory functions and atomic patterns
export { createBorder, createTextStyle, createRounded, createShadow } from './factories';
export { atomic } from './atomic';
export { filterBase, buttonBase } from './bases';

// Common/foundational styles
export { containers, headers } from './containers';
export { text, emptyState } from './typography';
export { buttons } from './buttons';
export { forms, inputs } from './forms';
export { cards } from './cards';
export { spacingUtils, switchConfig, profile } from './spacing';
export { modals } from './modals';
export { modalScreenStyles, viewModeToggleStyles } from './modalScreen';

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
import { containers, headers } from './containers';
import { text, emptyState } from './typography';
import { buttons } from './buttons';
import { forms, inputs } from './forms';
import { cards } from './cards';
import { spacingUtils, switchConfig, profile } from './spacing';
import { modals } from './modals';
import { modalScreenStyles, viewModeToggleStyles } from './modalScreen';
import { mapStyles, mapFooterStyles, mapComponentStyles } from './map';
import { filterComponentsStyles, drawerFiltersStyles, filterFABStyles } from './filters';
import { floatingMenuStyles, fabs as fabsStyles } from './navigation';

const commonStylesBase = {
  containers,
  headers,
  text,
  emptyState,
  cards,
  forms,
  buttons,
  inputs,
  spacingUtils,
  modals,
  modalScreenStyles,
  viewModeToggleStyles,
  profile,
};

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
