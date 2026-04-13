# LOC-07: comment-bloat-web-components — Remove verbose JSDoc from web-portal components and hooks

## Current state

Six files in `apps/web-portal/components/` and `apps/web-portal/lib/hooks/` contain
verbose multi-line JSDoc headers, redundant inline comments, and over-documented
interface properties.

### LocationPicker.tsx (224 lines)
- **Lines 3-20**: 18-line component JSDoc describing click/marker/geocoding flow — all evident from reading the code. Remove, replace with 1-line stub for lint.
- **Line 32-36**: 5-line `onLocationDetails` prop JSDoc — condense to 1-line WHY ("Structured address fields from reverse-geocoding for parent auto-fill").
- **Line 57**: `// Get user's current location` — obvious from `navigator.geolocation` call below.
- **Lines 81-83**: 3-line banner + SSR explanation — condense to 1 line: `// Leaflet accesses window/document — dynamic import avoids SSR crash.`
- **Line 85**: `// Only initialize map when we have a location and the container is ready` — obvious from guard clause.
- **Line 88**: `// Dynamically import Leaflet to avoid SSR issues` — duplicates condensed line 81.
- **Line 103**: `// Don't reinitialize if map already exists` — obvious from guard clause.
- **Line 117**: `// Add marker if there's a selected location` — obvious from conditional.
- **Line 122**: `// Handle map clicks` — obvious from `map.on('click', ...)`.
- **Line 132**: `// Update or create marker` — obvious from if/else.
- **Lines 142-143**: 2-line geocoding comment — condense to 1 line: `// Throttle reverse-geocoding to 1 req/sec`.
- **Lines 174-175**: 2-line structured details comment — condense to 1 line.
- **Line 192**: `// Cleanup` — obvious from return () => {...}.
- **KEEP**: Line 93 (webpack icon fix WHY), line 124 (prevent form submit WHY), line 180 (non-critical geocoding WHY), line 201 (prevent map recreation WHY).
- **Estimated savings**: 33 lines

### AdminHeader.tsx (102 lines)
- **Lines 17-24**: 8-line "SECURITY: Admin Header Component" JSDoc listing what displays — obvious from JSX. Replace with 1-line stub.
- **Line 50**: `{/* Left: Hamburger (mobile) + Logo and Title */}` — obvious from JSX.
- **Line 60**: `{/* Admin security badge */}` — obvious from JSX.
- **Line 67**: `{/* Right: User Info, Theme Toggle and Logout */}` — obvious from JSX.
- **Line 87**: `{/* Mobile sidebar drawer */}` — obvious from JSX.
- **Estimated savings**: 11 lines

### IngredientAutocomplete.tsx
- **Lines 3-14**: 12-line file header JSDoc describing search/debounce/filter behavior — all evident from code. Replace with 1-line stub for lint.
- **KEEP**: Line 25 (SelectedIngredient interface, 1-line useful), line 67 (filter duplicates WHY).
- **Estimated savings**: 11 lines

### useDishFormData.ts (379 lines)
- **Lines 1-7**: 7-line file header JSDoc — remove entirely (hook is not an exported `function` declaration needing its own JSDoc; the real export is below).
- **Line 19**: `/** Options for {@link useDishFormData}. */` — obvious. Remove.
- **Line 20**: `/** Existing dish to edit, or null/undefined for a new dish. */` — obvious from type. Remove.
- **Line 24**: `/** Pre-fills dishType from the parent menu's type. */` — obvious. Remove.
- **Lines 32-35**: 4-line `onWizardSubmit` JSDoc — condense to 1 line.
- **Line 39**: `/** Called to close the parent dialog after submit or cancel. */` — obvious. Remove.
- **Lines 62-75**: 14-line function JSDoc describing wizard vs DB mode — condense to 1-line stub with `@param`/`@returns` for lint.
- **Line 95**: `// Initialize dishType from menuType prop` — obvious.
- **Line 100**: `// Reset form when dish or open state changes` — obvious.
- **KEEP**: Lines 22 (reset timing WHY), 26/28 (DB mode context WHY), 30 (caller keeps form control WHY), 37 (DB save callback), 291 (sync junction WHY), 308 (sync option groups).
- **Estimated savings**: 29 lines

### useDebounce.ts (19 lines)
- **Lines 3-9**: 7-line JSDoc on a trivial 9-line hook. Replace with 1-line stub for lint.
- **Estimated savings**: 6 lines

### useRestaurantDraft.ts (272 lines)
- **Lines 3-9**: 7-line file header — remove.
- **Lines 44-50**: 7-line JSDoc on non-exported `loadDraftData` — remove entirely (not required by lint `publicOnly: true`).
- **Line 102**: `/** Options for {@link useRestaurantDraft}. */` — obvious. Remove.
- **Line 104**: `/** Authenticated user ID used to scope the localStorage key. */` — obvious. Remove.
- **Line 108**: `/** Ref holding the current selected cuisines array (not a form field). */` — remove.
- **Line 110**: `/** Ref holding the current operating-hours state (not a react-hook-form field). */` — remove.
- **Lines 120-130**: 11-line JSDoc on exported `useRestaurantDraft` — condense to 1-line stub.
- **Line 141**: `// Load draft data once on mount — useMemo ensures stable reference` — obvious.
- **Line 198**: `// Show saving indicator, then mark as saved after debounce settles` — obvious.
- **Lines 216-218**: 3-line JSDoc on exported `loadFormDefaults` — condense to 1-line stub.
- **KEEP**: Line 106 (auto-save trigger WHY), line 203 (`// slightly longer than autoSave debounce (500ms)` — timing WHY).
- **Estimated savings**: 32 lines

## Estimated LOC savings

~122 raw lines. After adding 1-line JSDoc stubs on exported functions (lint compliance) and potential prettier reformatting, conservative net: **90-110 lines**.

## Risk assessment

All removals are pure comments, JSDoc blocks, and section labels. No executable code is touched. Functionality is fully preserved.

**Lint compliance**: `jsdoc/require-jsdoc` (warn) requires JSDoc on exported `FunctionDeclaration` and `ClassDeclaration` with `publicOnly: true`. All exported functions keep a 1-line JSDoc stub with `@param`/`@returns` as needed. Interface-level JSDoc has no lint requirement.

**WHY-comments preserved**: webpack icon fix (LocationPicker:93), form submit prevention (LocationPicker:124), non-critical geocoding (LocationPicker:180), map recreation guard (LocationPicker:201), reset timing (useDishFormData:22), DB mode context (useDishFormData:26-28), auto-save trigger (useRestaurantDraft:106), debounce timing (useRestaurantDraft:203).

## Decision: apply

Safe to implement. Pure comment/JSDoc removal with zero side effects. Consistent with approach used in LOC-02 through LOC-04.
