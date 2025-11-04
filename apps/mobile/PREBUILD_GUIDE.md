# Expo Prebuild Guide for EatMe Mobile

## ⚠️ IMPORTANT: Read Before Running `npx expo prebuild --clean`

This document explains what happens during prebuild and what to verify afterward.

---

## What `npx expo prebuild --clean` Does

1. **DELETES** the entire `android/` and `ios/` folders
2. **REGENERATES** them from scratch based on:
   - `app.json` configuration
   - Installed packages (package.json)
   - Expo plugins
   - React Native version

---

## Current Manual Changes (Before Prebuild)

### ❌ Changes That Will Be LOST:

None! All your Mapbox configuration is now managed by the `@rnmapbox/maps` plugin in `app.json`.

### ✅ What's Now Automated by the Plugin:

The `@rnmapbox/maps` plugin in your `app.json` will automatically:

1. **Android `build.gradle`:**
   - Add `RNMapboxMapsImpl = 'mapbox'` to buildscript
   - Add Mapbox Maven repository with authentication

2. **Android `settings.gradle`:**
   - Add Mapbox Maven repository to dependencyResolutionManagement

3. **Android `gradle.properties`:**
   - Add `MAPBOX_DOWNLOADS_TOKEN` (from plugin config)

4. **iOS `Info.plist`:**
   - Add `MBXAccessToken` key with your token

---

## Steps to Run Prebuild Safely

### 1. Verify Plugin Configuration

Check that `app.json` has the Mapbox plugin:

```json
{
  "expo": {
    "plugins": [
      [
        "@rnmapbox/maps",
        {
          "RNMapboxMapsDownloadToken": "sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg"
        }
      ]
    ]
  }
}
```

✅ **This is already configured!**

### 2. Run Prebuild

```bash
cd /home/art/Documents/eatMe_v1/apps/mobile
npx expo prebuild --clean
```

This will:

- Delete `android/` and `ios/` folders
- Regenerate them with all configurations
- Apply the `@rnmapbox/maps` plugin automatically

### 3. Verify Mapbox Configuration

After prebuild completes, verify these files:

#### ✅ Check `android/gradle.properties`:

```bash
grep MAPBOX_DOWNLOADS_TOKEN android/gradle.properties
```

**Expected output:**

```properties
MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg
```

#### ✅ Check `android/build.gradle`:

```bash
grep -A 2 "RNMapboxMapsImpl" android/build.gradle
```

**Expected output:**

```gradle
ext {
  RNMapboxMapsImpl = 'mapbox'
}
```

And verify Mapbox Maven repository:

```bash
grep -A 5 "api.mapbox.com" android/build.gradle
```

**Expected:** Mapbox Maven repository with authentication

#### ✅ Check `android/settings.gradle`:

```bash
grep -A 5 "api.mapbox.com" android/settings.gradle
```

**Expected:** Mapbox Maven repository in dependencyResolutionManagement

#### ✅ Check `ios/mobile/Info.plist`:

```bash
grep -A 1 "MBXAccessToken" ios/mobile/Info.plist
```

**Expected output:**

```xml
<key>MBXAccessToken</key>
<string>sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg</string>
```

---

## If Something Goes Wrong

### Problem: Mapbox token missing from gradle.properties

**Solution:** The `@rnmapbox/maps` plugin should add it automatically, but if not:

```bash
echo "MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg" >> android/gradle.properties
```

### Problem: MBXAccessToken missing from iOS Info.plist

**Manual fix:**

1. Open `ios/mobile/Info.plist`
2. Add before the closing `</dict>` tag:

```xml
<key>MBXAccessToken</key>
<string>sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg</string>
```

### Problem: Mapbox Maven repository missing

This shouldn't happen with the plugin, but if it does, check:

1. Is `@rnmapbox/maps` in `package.json` dependencies?
2. Is the plugin correctly configured in `app.json`?
3. Try running `npx expo prebuild --clean` again

---

## Testing After Prebuild

### Local Android Build:

```bash
npx expo run:android
```

### EAS Build:

```bash
eas build --profile development --platform android
```

### Expected: ✅ No Mapbox Maven or SDK download errors

---

## Why This Approach is Better

### Before (Manual Configuration):

- ❌ Configurations lost on every `npx expo prebuild --clean`
- ❌ Need to manually restore from MAPBOX_RESTORATION.md
- ❌ Easy to forget steps
- ❌ Inconsistent between local and EAS builds

### After (Plugin-Based Configuration):

- ✅ Automatic configuration on every prebuild
- ✅ No manual steps needed
- ✅ Consistent across all environments
- ✅ Version controlled in app.json

---

## Environment Variables Reference

Your Mapbox tokens are stored in multiple places:

1. **`.env.example`** - Template for developers

   ```bash
   MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNTEwYjE0cnUyanEyNHF6MDljcXUifQ.qYqFsokHt-To0qNd_ibrNw
   MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg
   ```

2. **`app.json`** - Used by Expo plugin (DOWNLOADS token)

   ```json
   "RNMapboxMapsDownloadToken": "sk.eyJ1..."
   ```

3. **`eas.json`** - Used by EAS Build (DOWNLOADS token)

   ```json
   "env": {
     "MAPBOX_DOWNLOADS_TOKEN": "sk.eyJ1..."
   }
   ```

4. **Runtime** - Used by app at runtime (ACCESS token - pk.)
   - You'll need to pass this to your Mapbox components

---

## Quick Command Reference

```bash
# Clean prebuild (regenerates android/ and ios/)
npx expo prebuild --clean

# Run on Android emulator
npx expo run:android

# Run on iOS simulator
npx expo run:ios

# Create EAS development build
eas build --profile development --platform android

# Create EAS production build
eas build --profile production --platform android
```

---

## Notes

- **Token Types:**
  - `pk.` = Public access token (for runtime map display)
  - `sk.` = Secret token (for downloading Mapbox SDK during build)

- **Always use the secret (`sk.`) token for builds**
- The plugin handles token injection automatically
- EAS Build gets the token from `eas.json` as a backup

---

## Troubleshooting

### Build fails with "Could not find com.mapbox.maps:android-ndk27:10.19.0"

**Check:**

1. Is the token in `app.json` correct? (should start with `sk.`)
2. Run `npx expo prebuild --clean` to regenerate configs
3. Verify `gradle.properties` has `MAPBOX_DOWNLOADS_TOKEN`

### iOS build fails with Mapbox errors

**Check:**

1. Is `MBXAccessToken` in `ios/mobile/Info.plist`?
2. Run `npx expo prebuild --clean` to regenerate
3. Check plugin is in `app.json`

---

## Last Updated

November 3, 2025

Now managed by `@rnmapbox/maps` Expo plugin - no manual configuration needed! 🎉
