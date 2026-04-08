# Bundle & Startup Time Findings

## Investigation Date: 2026-04-07

---

### [High] No expo-image — Missing Image Caching Across the App

**File(s):** `apps/mobile/package.json`
**Severity:** High
**Effort:** Medium (1–3 days)

**Current behavior:**
The mobile app's `package.json` does not include `expo-image`. The only image-related package is `expo-image-picker` (for camera/gallery access). All image rendering uses the default `Image` from `react-native`.

Grep confirms: only `expo-image-picker` is imported across the codebase. No `expo-image`, `react-native-fast-image`, or similar caching library.

**Root cause:**
`expo-image` was never added to the project. The standard `Image` component has limited caching:
- iOS: Relies on NSURLCache (memory only, evicted under pressure)
- Android: No persistent disk cache for remote images

**Proposed fix:**
1. `npx expo install expo-image`
2. Replace all `Image` from `react-native` with `Image` from `expo-image`
3. `expo-image` uses `SDWebImage` (iOS) and `Glide` (Android) under the hood — automatic disk caching, memory caching, progressive loading, and blurhash placeholder support

**Estimated impact:**
Eliminates re-downloading images on every screen visit. For the restaurant detail screen (which shows dish photos) and map screen (restaurant images), this can save several MB of network traffic per session.

---

### [Medium] Mapbox SDK — Large Dependency Loaded Eagerly

**File(s):** `apps/mobile/src/screens/BasicMapScreen.tsx:3-4`, `apps/mobile/package.json:27`
**Severity:** Medium
**Effort:** Hard (> 3 days)

**Current behavior:**
```typescript
import Mapbox, { MapView, Camera, UserLocation, PointAnnotation } from '@rnmapbox/maps';
```
`@rnmapbox/maps` (v10.1.45) is imported at the top level of `BasicMapScreen.tsx`. This is the main screen of the app — the map SDK is loaded immediately on app start.

The Mapbox SDK is a large native module with significant initialization overhead. It includes tile rendering, vector data processing, and GL rendering capabilities.

**Root cause:**
The map is the primary screen, so eager loading is intentionally chosen. However, the SDK initialization could potentially be deferred until the map is actually rendered (after location permission is granted).

**Proposed fix:**
1. Defer Mapbox token configuration and initialization until after location permission is granted
2. Show a lightweight placeholder/skeleton while the map initializes
3. Consider whether `React.lazy` could wrap `MapView` (requires testing with native modules)

**Estimated impact:**
Could reduce TTI (Time to Interactive) by 200-500ms by deferring map initialization. Risk: may cause visible loading jank when transitioning to the map.

---

### [Medium] Web Portal Uses Dynamic Imports for LocationPicker — Good Pattern

**File(s):**
- `apps/web-portal/components/admin/NewRestaurantForm.tsx:37`
- `apps/web-portal/app/onboard/basic-info/page.tsx:46`
- `apps/web-portal/app/admin/menu-scan/page.tsx:53`

**Severity:** Low (positive finding)
**Effort:** N/A

**Current behavior:**
The web portal correctly uses Next.js `dynamic()` imports for the LocationPicker (Leaflet):
```typescript
const LocationPickerDynamic = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <div>Loading map...</div>,
});
```
This prevents the Leaflet library (~200KB) from being included in the SSR bundle and the initial page load.

**Root cause:**
N/A — good pattern already in place.

**Proposed fix:**
No change needed. This is the correct approach for heavy browser-only components.

**Estimated impact:**
N/A — confirming good pattern.

---

### [Medium] react-native-qrcode-svg — Small but Niche Dependency

**File(s):** `apps/mobile/package.json:44`
**Severity:** Low
**Effort:** Easy (< 1 day)

**Current behavior:**
`react-native-qrcode-svg` (v6.3.11) is listed as a top-level dependency. It's used only in the Eat Together feature (for generating session share codes). It depends on `react-native-svg`.

**Root cause:**
The dependency is relatively small and `react-native-svg` is already needed for other purposes. The bundle impact is minimal.

**Proposed fix:**
No immediate change needed. If bundle size becomes critical, this could be lazy-loaded since QR code display is only needed in the Eat Together session lobby screen.

**Estimated impact:**
Minimal — the dependency is small (~30KB minified). `react-native-svg` is already in the bundle.

---

### [Low] i18next — Full Library Imported

**File(s):** `apps/mobile/package.json:38-39`
**Severity:** Low
**Effort:** Easy (< 1 day)

**Current behavior:**
`i18next` (v25.8.7) and `react-i18next` (v16.5.4) are imported. These are well-treeshaken libraries, but all translation namespaces are likely loaded at startup.

**Root cause:**
Standard internationalization setup. The libraries are appropriately sized for the use case.

**Proposed fix:**
1. Verify that translation files are lazy-loaded by namespace (only load the current language + current screen's namespace)
2. If all translations are loaded at startup, split by namespace and use `i18next-resources-to-backend` for lazy loading

**Estimated impact:**
Minor — translation files are typically small (10-50KB). Only worth optimizing if the app supports 5+ languages with large translation files.

---

### [Low] No Expo Prebuild Configuration for Tree-Shaking Noted

**File(s):** `apps/mobile/package.json`
**Severity:** Low
**Effort:** Easy (< 1 day)

**Current behavior:**
No custom Metro bundler configuration detected (no `metro.config.js` in mobile app root). Expo's default Metro configuration handles tree-shaking for SDK 54.

**Root cause:**
Expo SDK 54 uses Metro with automatic tree-shaking enabled by default for production builds.

**Proposed fix:**
Verify production build output includes tree-shaking by checking the bundle size with `npx expo export --platform ios` and examining the output. No configuration change likely needed.

**Estimated impact:**
N/A — Expo handles this automatically.
