# EatMe Mobile Application - Complete Setup Guide

**Last Updated:** November 3, 2025  
**Project:** EatMe v1.1  
**Platform:** React Native with Expo

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Configuration Files Explained](#configuration-files-explained)
5. [Node.js & Package Management](#nodejs--package-management)
6. [Gradle Build System](#gradle-build-system)
7. [Android Native Configuration](#android-native-configuration)
8. [iOS Native Configuration](#ios-native-configuration)
9. [Expo Configuration](#expo-configuration)
10. [Build Processes](#build-processes)
11. [Local vs EAS Build](#local-vs-eas-build)
12. [Mapbox Integration](#mapbox-integration)
13. [Troubleshooting](#troubleshooting)
14. [Common Commands](#common-commands)

---

## Project Overview

**EatMe Mobile** is a React Native application built with Expo that helps users discover nearby restaurants using Mapbox maps and location services.

### Key Features:

- Interactive Mapbox maps
- Location-based restaurant discovery
- React Navigation for routing
- Zustand for state management
- Expo modules for native functionality

---

## Technology Stack

### Core Framework

- **React Native:** 0.81.4
- **React:** 19.1.0
- **Expo SDK:** 54 (~54.0.13)

### Build Tools

- **Node.js:** v22.20.0
- **Package Manager:** pnpm v9.0.0
- **Gradle:** 8.14.3
- **Android Gradle Plugin:** Latest (via Expo)

### Key Dependencies

- **@rnmapbox/maps:** ^10.1.45 (Mapbox integration)
- **expo-dev-client:** ~6.0.15 (custom development builds)
- **react-native-reanimated:** ~4.1.3 (animations)
- **react-navigation:** ^7.x (navigation)
- **zustand:** ^5.0.8 (state management)

### Development Tools

- **EAS CLI:** For cloud builds
- **Expo CLI:** For local development
- **TypeScript:** ^5.9.2

---

## Project Structure

```
apps/mobile/
├── src/                          # Application source code
│   ├── components/              # React components
│   ├── screens/                 # Screen components
│   ├── navigation/              # Navigation configuration
│   ├── store/                   # Zustand state management
│   └── styles/                  # Style definitions
│
├── android/                      # Android native code (generated)
│   ├── app/                     # Main app module
│   │   ├── src/main/
│   │   │   ├── java/           # Java/Kotlin code
│   │   │   ├── res/            # Android resources
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle        # App-level Gradle config
│   ├── gradle/                  # Gradle wrapper
│   │   └── wrapper/
│   │       └── gradle-wrapper.properties
│   ├── build.gradle            # Project-level Gradle config
│   ├── settings.gradle         # Gradle settings & plugins
│   └── gradle.properties       # Gradle properties & secrets
│
├── ios/                         # iOS native code (generated)
│   ├── mobile/                 # Main app target
│   │   ├── AppDelegate.mm      # iOS app entry point
│   │   └── Info.plist          # iOS app configuration
│   ├── mobile.xcodeproj/       # Xcode project
│   └── Podfile                 # CocoaPods dependencies
│
├── app.json                     # Expo configuration
├── eas.json                     # EAS Build configuration
├── babel.config.js              # Babel transpilation config
├── tsconfig.json               # TypeScript configuration
├── package.json                # Node dependencies
├── pnpm-lock.yaml              # Locked dependency versions
├── .env.example                # Environment variables template
│
├── MOBILE_APP_SETUP_GUIDE.md   # This file
└── PREBUILD_GUIDE.md           # Expo prebuild instructions
```

---

## Configuration Files Explained

### 1. `package.json`

**Purpose:** Defines project metadata and dependencies

**Key Sections:**

```json
{
  "name": "mobile",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios"
  },
  "dependencies": {
    "@rnmapbox/maps": "^10.1.45",
    "expo": "~54.0.13",
    "react-native": "0.81.4"
  },
  "devDependencies": {
    "typescript": "^5.9.2",
    "@types/react": "19.1.17"
  }
}
```

**What it controls:**

- All JavaScript/TypeScript dependencies
- NPM/pnpm scripts for common tasks
- Project metadata (name, version)

---

### 2. `pnpm-lock.yaml`

**Purpose:** Locks exact versions of all dependencies and sub-dependencies

**Why it matters:**

- Ensures reproducible builds across machines
- Prevents "works on my machine" issues
- Must be committed to version control
- EAS Build uses `--frozen-lockfile` (fails if outdated)

**When to regenerate:**

```bash
rm pnpm-lock.yaml
pnpm install
```

---

### 3. `app.json`

**Purpose:** Main Expo configuration file

**Key Sections:**

```json
{
  "expo": {
    "name": "mobile",
    "slug": "mobile",
    "version": "1.0.0",
    "android": {
      "package": "com.anonymous.mobile",
      "permissions": ["ACCESS_FINE_LOCATION"]
    },
    "ios": {
      "bundleIdentifier": "com.anonymous.mobile"
    },
    "plugins": [
      [
        "expo-location",
        {
          /* config */
        }
      ],
      [
        "@rnmapbox/maps",
        {
          "RNMapboxMapsDownloadToken": "sk.xxx"
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "e58b678b-ccce-4ae8-a799-c15e13007040"
      }
    }
  }
}
```

**What it controls:**

- App name, icon, splash screen
- Platform-specific configurations
- Permissions (location, camera, etc.)
- Expo plugins that modify native code
- EAS project ID

**Plugins:**

- Expo plugins run during `expo prebuild`
- They modify native Android/iOS files automatically
- `@rnmapbox/maps` plugin adds Mapbox configuration

---

### 4. `eas.json`

**Purpose:** EAS Build and Submit configuration

**Structure:**

```json
{
  "cli": {
    "version": ">= 16.19.3",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "MAPBOX_DOWNLOADS_TOKEN": "sk.xxx"
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Build Profiles:**

| Profile       | Purpose                      | Output        | Use Case                 |
| ------------- | ---------------------------- | ------------- | ------------------------ |
| `development` | Testing with expo-dev-client | APK (Android) | Local testing, debugging |
| `preview`     | Internal testing             | AAB/IPA       | Beta testing             |
| `production`  | App store release            | AAB/IPA       | Public release           |

**Environment Variables:**

- `env` section injects variables into the build
- Used for secrets (API keys, tokens)
- Available during build process only

---

### 5. `babel.config.js`

**Purpose:** Configures Babel JavaScript transpiler

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

**What it does:**

- Transpiles modern JS/TS to compatible versions
- `babel-preset-expo`: Expo's preset (includes React Native)
- `react-native-reanimated/plugin`: Enables worklets for animations

**Critical:** reanimated plugin must be **last** in plugins array

---

### 6. `tsconfig.json`

**Purpose:** TypeScript compiler configuration

**Key Settings:**

- `target`: ES version to compile to
- `moduleResolution`: How imports are resolved
- `strict`: Type checking strictness
- `paths`: Module path aliases

---

### 7. `.env.example`

**Purpose:** Template for environment variables

```bash
# Mapbox Configuration
MAPBOX_ACCESS_TOKEN=pk.xxx        # Public token (runtime)
MAPBOX_DOWNLOADS_TOKEN=sk.xxx     # Secret token (build-time)

# Development Configuration
NODE_ENV=development
DEBUG=true

# Location Configuration
DEFAULT_LATITUDE=19.4326
DEFAULT_LONGITUDE=-99.1332
```

**Token Types:**

- `pk.*` - Public token: Safe to expose, used at runtime
- `sk.*` - Secret token: Keep private, used for SDK downloads

**Usage:**

1. Copy to `.env.local`
2. Add real values
3. Never commit `.env.local` to git

---

## Node.js & Package Management

### Node.js Version

**Current:** v22.20.0

**Why this version:**

- Compatible with Expo SDK 54
- Supports latest JavaScript features
- Required by React Native 0.81.4

**Version Management:**
Use `nvm` (Node Version Manager):

```bash
nvm install 22.20.0
nvm use 22.20.0
```

---

### Package Manager: pnpm

**Why pnpm (not npm/yarn)?**

- Faster installations (hard links, not copies)
- Disk space efficient
- Strict dependency resolution (prevents phantom dependencies)
- Better monorepo support

**Common Commands:**

```bash
pnpm install              # Install all dependencies
pnpm add <package>        # Add dependency
pnpm remove <package>     # Remove dependency
pnpm update <package>     # Update dependency
pnpm install --frozen-lockfile  # Install without modifying lockfile
```

**Lock File:**

- `pnpm-lock.yaml` must be committed
- EAS Build fails if lockfile doesn't match package.json
- Regenerate if dependencies are out of sync

---

### Dependency Types

```json
{
  "dependencies": {
    // Runtime dependencies (bundled with app)
    "react-native": "0.81.4",
    "@rnmapbox/maps": "^10.1.45"
  },
  "devDependencies": {
    // Development-only (not bundled)
    "typescript": "^5.9.2",
    "@types/react": "19.1.17"
  },
  "peerDependencies": {
    // Required by other packages (not auto-installed)
  }
}
```

**Version Prefixes:**

- `^1.2.3` - Compatible with 1.x.x (allows minor/patch updates)
- `~1.2.3` - Compatible with 1.2.x (allows patch updates only)
- `1.2.3` - Exact version (no updates)

---

## Gradle Build System

### What is Gradle?

**Gradle** is the build system for Android apps. It:

- Compiles Java/Kotlin code
- Packages resources (images, XML)
- Manages dependencies (libraries)
- Signs APK/AAB files
- Runs build tasks

**Version:** 8.14.3 (defined in `gradle-wrapper.properties`)

---

### Gradle File Hierarchy

```
android/
├── gradle/wrapper/
│   └── gradle-wrapper.properties    # Gradle version
├── settings.gradle                  # Project settings (evaluated FIRST)
├── build.gradle                     # Root project config (evaluated SECOND)
└── app/
    └── build.gradle                # App module config (evaluated THIRD)
```

**Evaluation Order:**

1. `settings.gradle` - Initializes project, defines modules
2. Root `build.gradle` - Configures all modules
3. Module `build.gradle` - Configures specific module (app)

---

### `gradle-wrapper.properties`

**Location:** `android/gradle/wrapper/gradle-wrapper.properties`

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.3-bin.zip
```

**What it does:**

- Specifies exact Gradle version
- Downloads Gradle if not present
- Ensures consistent builds across machines

**Wrapper Script:**

- `./gradlew` (Linux/Mac) or `gradlew.bat` (Windows)
- Uses the version specified in properties file
- No global Gradle installation needed

---

### `settings.gradle`

**Purpose:** Project initialization and plugin management

**Key Sections:**

#### 1. Plugin Management

```gradle
pluginManagement {
  def reactNativeGradlePlugin = new File(...)
  includeBuild(reactNativeGradlePlugin)

  def expoPluginsPath = new File(...)
  includeBuild(expoPluginsPath)
}
```

- Locates React Native and Expo plugins
- Uses Node.js to resolve plugin paths
- Composite builds for plugin development

#### 2. Apply Plugins

```gradle
plugins {
  id("com.facebook.react.settings")
  id("expo-autolinking-settings")
}
```

- React Native settings plugin
- Expo autolinking (auto-configures native modules)

#### 3. Dependency Resolution (Modern Approach)

```gradle
dependencyResolutionManagement {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }

    maven {
      url 'https://api.mapbox.com/downloads/v2/releases/maven'
      authentication { basic(BasicAuthentication) }
      credentials {
        username = 'mapbox'
        password = providers.gradleProperty('MAPBOX_DOWNLOADS_TOKEN')
          .orElse(providers.environmentVariable('MAPBOX_DOWNLOADS_TOKEN'))
          .getOrElse('')
      }
    }
  }
}
```

- **Centralized repository management** (Gradle 7+)
- All modules use these repositories
- Mapbox Maven requires authentication

#### 4. Project Structure

```gradle
rootProject.name = 'mobile'
include ':app'
```

- Defines project name
- Includes the `:app` module

#### 5. Expo Autolinking

```gradle
extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)
}
expoAutolinking.useExpoModules()
```

- Automatically links native modules
- No manual configuration needed for most packages

---

### Root `build.gradle`

**Purpose:** Project-wide build configuration

**Key Sections:**

#### 1. Buildscript

```gradle
buildscript {
  ext {
    RNMapboxMapsImpl = 'mapbox'
  }
  repositories {
    google()
    mavenCentral()
  }
  dependencies {
    classpath('com.android.tools.build:gradle')
    classpath('com.facebook.react:react-native-gradle-plugin')
    classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
  }
}
```

**`ext` (Extensions):**

- Global variables available to all modules
- `RNMapboxMapsImpl = 'mapbox'`:
  - Tells @rnmapbox/maps to use Mapbox SDK (not MapLibre)
  - Options: `'mapbox'` or `'maplibre'`
  - Critical for SDK selection

**`repositories`:**

- Where to download build tools from
- Google and Maven Central for Android/Gradle plugins

**`dependencies`:**

- Build-time dependencies (not app dependencies)
- Android Gradle Plugin
- React Native Gradle Plugin
- Kotlin Gradle Plugin

#### 2. All Projects (Legacy Repository Config)

```gradle
allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
  }
}
```

- Legacy approach (pre-Gradle 7)
- Backup for modules that don't use `dependencyResolutionManagement`

#### 3. Mapbox Maven (Added by Plugin)

```gradle
// @generated begin @rnmapbox/maps-v2-maven
allprojects {
  repositories {
    maven {
      url 'https://api.mapbox.com/downloads/v2/releases/maven'
      authentication { basic(BasicAuthentication) }
      credentials {
        username = 'mapbox'
        password = project.properties['MAPBOX_DOWNLOADS_TOKEN'] ?: ""
      }
    }
  }
}
// @generated end @rnmapbox/maps-v2-maven
```

- Added automatically by `@rnmapbox/maps` plugin
- Allows downloading Mapbox Android SDK
- Requires authentication with secret token

#### 4. Plugin Applications

```gradle
apply plugin: "expo-root-project"
apply plugin: "com.facebook.react.rootproject"
```

- Applies Expo and React Native root plugins
- Configures project for React Native development

---

### App `build.gradle`

**Location:** `android/app/build.gradle`

**Purpose:** App module configuration (not modified by us, managed by Expo)

**Key Sections:**

- `android { }` - Android configuration (SDK versions, build types)
- `dependencies { }` - App dependencies
- React Native configuration
- Signing configuration for releases

---

### `gradle.properties`

**Purpose:** Gradle properties and secrets

**Key Properties:**

```properties
# JVM Settings
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m

# Performance
org.gradle.parallel=true

# Android
android.useAndroidX=true
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64

# React Native Features
newArchEnabled=true
hermesEnabled=true
edgeToEdgeEnabled=true

# Expo Features
expo.gif.enabled=true
expo.webp.enabled=true
EX_DEV_CLIENT_NETWORK_INSPECTOR=true

# Mapbox Secret Token
MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg
```

**Important Settings:**

| Property                 | Value       | Purpose                       |
| ------------------------ | ----------- | ----------------------------- |
| `org.gradle.jvmargs`     | `-Xmx2048m` | Gradle memory allocation      |
| `newArchEnabled`         | `true`      | New React Native architecture |
| `hermesEnabled`          | `true`      | Use Hermes JS engine          |
| `MAPBOX_DOWNLOADS_TOKEN` | `sk.xxx`    | Mapbox SDK authentication     |

**Security:**

- This file can contain secrets
- Should be in `.gitignore` for sensitive projects
- EAS Build gets token from `eas.json` env variables

---

### How Gradle Resolves Dependencies

**Process:**

1. Module `build.gradle` declares dependency:

   ```gradle
   dependencies {
     implementation 'com.mapbox.maps:android:10.19.0'
   }
   ```

2. Gradle searches repositories (in order):
   - From `settings.gradle` (modern)
   - From `allprojects` in root `build.gradle` (legacy)

3. For Mapbox Maven:
   - URL: `https://api.mapbox.com/downloads/v2/releases/maven`
   - Sends Basic Auth: `username=mapbox, password=sk.xxx`
   - Downloads artifact if found

4. Caches locally:
   - `~/.gradle/caches/`
   - Reused across builds

**If dependency not found:**

```
Could not find com.mapbox.maps:android:10.19.0
Searched in:
  - https://dl.google.com/...
  - https://repo.maven.apache.org/...
  - (Mapbox Maven NOT searched → authentication issue)
```

---

## Android Native Configuration

### `AndroidManifest.xml`

**Location:** `android/app/src/main/AndroidManifest.xml`

**Purpose:** Declares app metadata and permissions

**Key Elements:**

```xml
<manifest>
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.INTERNET" />

  <application
    android:name=".MainApplication"
    android:label="@string/app_name"
    android:icon="@mipmap/ic_launcher">

    <activity android:name=".MainActivity">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
```

**Auto-configured by:**

- Expo prebuild
- Expo plugins (location, Mapbox)
- Usually don't need manual edits

---

### Java/Kotlin Source Code

**Location:** `android/app/src/main/java/com/anonymous/mobile/`

**Files:**

- `MainApplication.java` - App initialization
- `MainActivity.java` - Main activity (entry point)

**Generated by Expo** - rarely need modification

---

### Resources

**Location:** `android/app/src/main/res/`

**Structure:**

```
res/
├── drawable/      # Images
├── mipmap/        # App icons (various DPI)
├── values/        # Strings, colors, styles
└── xml/           # XML resources
```

**Managed by Expo** - configured via `app.json`

---

## iOS Native Configuration

### `Info.plist`

**Location:** `ios/mobile/Info.plist`

**Purpose:** iOS app configuration

**Key Entries:**

```xml
<dict>
  <key>CFBundleDisplayName</key>
  <string>mobile</string>

  <key>CFBundleIdentifier</key>
  <string>com.anonymous.mobile</string>

  <key>NSLocationWhenInUseUsageDescription</key>
  <string>This app uses location to show nearby restaurants</string>

  <key>MBXAccessToken</key>
  <string>sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg</string>
</dict>
```

**Key Configurations:**

- Bundle identifier (must be unique)
- Permission descriptions (shown to users)
- Mapbox access token (for runtime)

**Modified by:**

- Expo prebuild
- `@rnmapbox/maps` plugin (should add MBXAccessToken)
- Manual edits if needed

---

### `Podfile`

**Purpose:** CocoaPods dependency management (iOS equivalent of Gradle)

**Auto-generated by Expo** - manages native iOS dependencies

---

## Expo Configuration

### What is Expo?

**Expo** is a framework and platform for React Native:

- **Managed workflow:** Expo handles native code
- **Bare workflow:** You control native code (our setup)
- **Expo modules:** Cross-platform native modules
- **EAS Build:** Cloud build service
- **OTA Updates:** Push updates without app store

### Our Setup: Bare Workflow

**Why bare?**

- Need custom native code (Mapbox requires config)
- More control over build process
- Can use any native library

**How it works:**

1. We have `android/` and `ios/` folders (native code)
2. Expo manages these via `expo prebuild`
3. We can customize native files
4. Plugins automate common modifications

---

### Expo Prebuild

**Command:** `npx expo prebuild --clean`

**What it does:**

1. **Deletes** `android/` and `ios/` folders
2. **Reads** `app.json` configuration
3. **Generates** native folders from scratch
4. **Applies** Expo plugins
5. **Configures** native code based on settings

**When to run:**

- After changing `app.json`
- After adding/removing plugins
- When native code is corrupted
- Starting fresh

**Plugin execution:**

- Each plugin in `app.json` runs
- Modifies native files automatically
- Example: `@rnmapbox/maps` plugin adds Mapbox config

---

### Expo Autolinking

**What it is:**
Automatic native module linking (no manual steps)

**Traditional React Native (before autolinking):**

```bash
# Manual steps for each native module
react-native link @react-navigation/native
# Edit AndroidManifest.xml
# Edit build.gradle
# Edit iOS Podfile
# Run pod install
```

**With Expo autolinking:**

```bash
# Just install the package
pnpm add @react-navigation/native
# Everything else automatic!
```

**How it works:**

1. Scans `node_modules/` for native modules
2. Reads module configuration (package.json)
3. Automatically links to Android/iOS
4. Configured in `settings.gradle` and `Podfile`

---

### expo-dev-client

**What it is:**
Custom development build with debugging tools

**Why we need it:**

- Standard Expo Go app doesn't support custom native code
- We use Mapbox (requires custom native config)
- Need a custom development build

**Features:**

- Full debugging capabilities
- Fast Refresh / Hot Reload
- Network inspector
- Dev menu (shake device)

**Installation:**

```bash
pnpm add expo-dev-client
```

**Usage:**

```bash
# Build development client
eas build --profile development --platform android

# Or locally
npx expo run:android
```

---

## Build Processes

### Build Types Overview

| Build Type     | Purpose     | Output                   | Signing              |
| -------------- | ----------- | ------------------------ | -------------------- |
| **Debug**      | Development | APK                      | Debug key            |
| **Release**    | Testing     | APK/AAB                  | Debug or Release key |
| **Production** | App Store   | AAB (Android), IPA (iOS) | Release key          |

---

### Local Build Process

**Command:** `npx expo run:android`

**What happens:**

1. **Metro Bundler starts**
   - JavaScript bundler (like Webpack)
   - Watches for file changes
   - Serves JS bundle to app
   - Port: 8081

2. **Gradle build runs**

   ```
   cd android
   ./gradlew app:assembleDebug
   ```

   - Resolves dependencies (Maven)
   - Compiles Java/Kotlin code
   - Packages resources
   - Creates debug APK

3. **APK installed on device/emulator**

   ```
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

4. **App launches**
   - Connects to Metro bundler
   - Loads JavaScript bundle
   - Starts React Native app

**Output:** Debug APK at `android/app/build/outputs/apk/debug/app-debug.apk`

**Requirements:**

- Android SDK installed
- Emulator running or device connected
- Java JDK 17+
- Metro bundler running

---

### EAS Build Process

**Command:** `eas build --profile development --platform android`

**What happens:**

1. **Code uploaded to EAS servers**
   - Your source code (minus node_modules)
   - `package.json` and `pnpm-lock.yaml`
   - Configuration files

2. **Cloud build environment created**
   - Ubuntu Linux container
   - Node.js installed
   - Android SDK installed
   - Java JDK installed

3. **Dependencies installed**

   ```bash
   pnpm install --frozen-lockfile
   ```

   - Must match lockfile exactly
   - Fails if lockfile outdated

4. **Prebuild runs** (if needed)

   ```bash
   npx expo prebuild
   ```

   - Generates `android/` folder
   - Applies plugins

5. **Gradle build runs**

   ```bash
   cd android
   ./gradlew app:assembleRelease  # or assembleDebug
   ```

   - Uses `eas.json` environment variables
   - Accesses secrets securely

6. **Build artifact uploaded**
   - APK or AAB uploaded to EAS servers
   - Available for download
   - Can install via QR code

**Output:**

- Development: APK (easier to install)
- Production: AAB (required by Google Play)

**Advantages:**

- No local Android SDK needed
- Consistent build environment
- Faster (powerful servers)
- Build logs stored
- Artifact storage

**Disadvantages:**

- Requires internet
- Build queue time
- Limited free builds (subscription needed)

---

## Local vs EAS Build

### Detailed Comparison

| Aspect            | Local Build                | EAS Build                         |
| ----------------- | -------------------------- | --------------------------------- |
| **Command**       | `npx expo run:android`     | `eas build --profile development` |
| **Location**      | Your machine               | Expo cloud servers                |
| **Requirements**  | Android SDK, JDK, Emulator | Internet connection only          |
| **Speed**         | Fast (after initial setup) | ~5-10 minutes                     |
| **Output**        | Debug APK                  | APK or AAB (configurable)         |
| **Installation**  | Auto-installs on emulator  | Download and install manually     |
| **Environment**   | Your environment           | Clean, reproducible environment   |
| **Secrets**       | From local files           | From `eas.json` env vars          |
| **Cost**          | Free                       | Limited free builds/month         |
| **Metro Bundler** | Required (serves JS)       | Not needed (JS bundled in app)    |
| **Use Case**      | Active development         | Testing, distribution, production |

---

### When to Use Local Build

✅ **Use local build when:**

- Actively developing
- Need fast iteration
- Testing frequently
- Debugging issues
- Have Android SDK set up

**Workflow:**

```bash
# Terminal 1: Start Metro
npx expo start

# Terminal 2: Build and install
npx expo run:android

# Code changes → Fast Refresh (instant)
```

---

### When to Use EAS Build

✅ **Use EAS build when:**

- Don't have Android SDK
- Need reproducible builds
- Creating release builds
- Distributing to testers
- Preparing for app store
- CI/CD pipeline

**Workflow:**

```bash
# Start build
eas build --profile development --platform android

# Wait 5-10 minutes
# Download APK from link
# Install on device
```

---

### Build Configuration Files

#### Local Build Uses:

- `android/build.gradle`
- `android/settings.gradle`
- `android/gradle.properties`
- Local environment variables

#### EAS Build Uses:

- `eas.json` (build configuration)
- `app.json` (Expo configuration)
- `eas.json` env vars (secrets)
- Generates native code fresh (prebuild)

---

### Metro Bundler

**What it is:**
JavaScript bundler for React Native (like Webpack)

**What it does:**

- Watches source files for changes
- Transpiles JavaScript/TypeScript (via Babel)
- Bundles modules into single file
- Serves bundle to app
- Enables Fast Refresh

**When it runs:**

- **Local builds:** Always (development server)
- **EAS builds:** During build (bundle embedded in APK)

**Ports:**

- Main: 8081 (bundle server)
- Websocket: Random (for debugging)

**Commands:**

```bash
npx expo start           # Start Metro
npx expo start --clear   # Clear cache and start
```

---

## Mapbox Integration

### Why Mapbox Configuration is Complex

**Problem:** Mapbox Android SDK is not on public Maven repositories

**Solution:** Use Mapbox's private Maven repository with authentication

---

### Mapbox Components

#### 1. JavaScript Package

```bash
pnpm add @rnmapbox/maps
```

- React Native components for maps
- JavaScript API
- Requires native SDK

#### 2. Native Android SDK

- Not manually installed
- Gradle downloads automatically
- From Mapbox Maven repository
- Requires authentication

#### 3. Configuration Files

**`app.json` - Plugin Configuration:**

```json
{
  "plugins": [
    [
      "@rnmapbox/maps",
      {
        "RNMapboxMapsDownloadToken": "sk.xxx"
      }
    ]
  ]
}
```

- Tells plugin which token to use
- Applied during `expo prebuild`

**`android/build.gradle` - SDK Selection:**

```gradle
buildscript {
  ext {
    RNMapboxMapsImpl = 'mapbox'
  }
}
```

- Tells native code to use Mapbox SDK (not MapLibre)

**`android/build.gradle` - Maven Repository:**

```gradle
allprojects {
  repositories {
    maven {
      url 'https://api.mapbox.com/downloads/v2/releases/maven'
      authentication { basic(BasicAuthentication) }
      credentials {
        username = 'mapbox'
        password = project.properties['MAPBOX_DOWNLOADS_TOKEN'] ?: ""
      }
    }
  }
}
```

- Adds Mapbox Maven with authentication
- Uses token from `gradle.properties`

**`android/settings.gradle` - Maven Repository (Modern):**

```gradle
dependencyResolutionManagement {
  repositories {
    maven {
      url 'https://api.mapbox.com/downloads/v2/releases/maven'
      authentication { basic(BasicAuthentication) }
      credentials {
        username = 'mapbox'
        password = providers.gradleProperty('MAPBOX_DOWNLOADS_TOKEN')
          .orElse(providers.environmentVariable('MAPBOX_DOWNLOADS_TOKEN'))
          .getOrElse('')
      }
    }
  }
}
```

- Modern approach (Gradle 7+)
- Same repository, different syntax

**`android/gradle.properties` - Token Storage:**

```properties
MAPBOX_DOWNLOADS_TOKEN=sk.xxx
```

- Secret token stored here
- Read by Gradle during build

**`ios/mobile/Info.plist` - iOS Token:**

```xml
<key>MBXAccessToken</key>
<string>sk.xxx</string>
```

- Token for iOS runtime
- Maps won't display without it

**`eas.json` - EAS Build Token:**

```json
{
  "build": {
    "development": {
      "env": {
        "MAPBOX_DOWNLOADS_TOKEN": "sk.xxx"
      }
    }
  }
}
```

- Token for EAS cloud builds
- Injected as environment variable

---

### Mapbox Token Types

| Token Type       | Format   | Usage                      | Security       |
| ---------------- | -------- | -------------------------- | -------------- |
| **Public Token** | `pk.xxx` | Runtime map rendering      | Safe to expose |
| **Secret Token** | `sk.xxx` | SDK downloads (build-time) | Keep private   |

**Our setup:**

- Use `sk.` (secret) for SDK downloads
- Same `sk.` token for iOS runtime (works but not ideal)
- Should use `pk.` for runtime, but `sk.` works too

---

### Mapbox Build Flow

**Local Build:**

```
1. Gradle reads gradle.properties
   ↓
2. Finds MAPBOX_DOWNLOADS_TOKEN=sk.xxx
   ↓
3. Adds credentials to Mapbox Maven request
   ↓
4. Downloads com.mapbox.maps:android:10.19.0
   ↓
5. Caches in ~/.gradle/caches/
   ↓
6. Compiles app with Mapbox SDK
   ↓
7. Creates APK
```

**EAS Build:**

```
1. Reads eas.json env.MAPBOX_DOWNLOADS_TOKEN
   ↓
2. Runs expo prebuild
   ↓
3. Plugin reads RNMapboxMapsDownloadToken from app.json
   ↓
4. Adds MAPBOX_DOWNLOADS_TOKEN to gradle.properties
   ↓
5. Adds Maven repository to build.gradle
   ↓
6. Gradle downloads SDK with authentication
   ↓
7. Builds APK/AAB
```

---

### Common Mapbox Errors

#### Error: "Could not find com.mapbox.maps:android:10.19.0"

**Cause:** Mapbox Maven repository not searched

**Solutions:**

1. Check `MAPBOX_DOWNLOADS_TOKEN` in `gradle.properties`
2. Verify token starts with `sk.` (not `pk.`)
3. Check Maven repository in `build.gradle` and `settings.gradle`
4. Ensure credentials syntax is correct

#### Error: "401 Unauthorized" accessing Mapbox Maven

**Cause:** Invalid or missing token

**Solutions:**

1. Get new secret token from Mapbox dashboard
2. Update in all locations (app.json, eas.json, gradle.properties)
3. Verify token hasn't expired

#### Error: "RNMapboxMapsImpl not defined"

**Cause:** Missing `ext { RNMapboxMapsImpl = 'mapbox' }`

**Solution:**
Add to `android/build.gradle` buildscript:

```gradle
buildscript {
  ext {
    RNMapboxMapsImpl = 'mapbox'
  }
}
```

---

## Troubleshooting

### General Debugging Approach

1. **Read the error message carefully**
   - Error messages usually indicate the problem
   - Look for file names, line numbers

2. **Check recent changes**
   - What changed since it last worked?
   - Git diff can help

3. **Clean and rebuild**

   ```bash
   # Clean native builds
   cd android
   ./gradlew clean
   cd ..

   # Clean Metro cache
   npx expo start --clear

   # Reinstall dependencies
   rm -rf node_modules
   pnpm install
   ```

4. **Check logs**
   - Metro bundler output
   - Gradle build logs
   - adb logcat (Android logs)

---

### Common Issues

#### Issue: "ENOSPC: System limit for number of file watchers reached"

**Cause:** Too many files being watched (common on Linux)

**Solution:**

```bash
# Increase file watcher limit
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### Issue: "Unable to resolve module"

**Cause:** Import path incorrect or package not installed

**Solutions:**

1. Check import statement
2. Verify package in package.json
3. Run `pnpm install`
4. Restart Metro bundler

#### Issue: "Gradle build failed"

**Cause:** Various (dependency, configuration, SDK)

**Debug steps:**

1. Run with stacktrace: `./gradlew app:assembleDebug --stacktrace`
2. Check Gradle version compatibility
3. Verify all repositories configured
4. Clean build: `./gradlew clean`

#### Issue: "Metro port 8081 already in use"

**Cause:** Previous Metro instance still running

**Solution:**

```bash
# Kill process on port 8081
npx kill-port 8081

# Or manually
lsof -ti:8081 | xargs kill -9
```

#### Issue: "pnpm-lock.yaml out of date"

**Cause:** package.json changed, lockfile not updated

**Solution:**

```bash
pnpm install
# Commit updated pnpm-lock.yaml
```

#### Issue: "No connected devices"

**Cause:** Emulator not running or device not connected

**Solutions:**

```bash
# List devices
adb devices

# Start emulator (if installed)
emulator -avd Pixel_5_API_33

# Check USB debugging enabled on physical device
```

---

### Build Debugging

#### Get detailed Gradle output:

```bash
cd android
./gradlew app:assembleDebug --info
```

#### Check dependency tree:

```bash
./gradlew app:dependencies
```

#### Verify Gradle configuration:

```bash
./gradlew properties
```

---

## Common Commands

### Development

```bash
# Start Metro bundler
npx expo start

# Start and clear cache
npx expo start --clear

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios

# Open dev menu on device
# Shake device or:
adb shell input keyevent 82
```

---

### Building

```bash
# Local debug build
npx expo run:android

# EAS development build
eas build --profile development --platform android

# EAS production build
eas build --profile production --platform android

# Local release build
cd android
./gradlew app:assembleRelease
```

---

### Expo Commands

```bash
# Regenerate native code
npx expo prebuild

# Clean regeneration
npx expo prebuild --clean

# Install package
npx expo install <package>

# Doctor (check configuration)
npx expo-doctor
```

---

### Gradle Commands

```bash
cd android

# Build debug APK
./gradlew app:assembleDebug

# Build release APK
./gradlew app:assembleRelease

# Clean build
./gradlew clean

# List tasks
./gradlew tasks

# Dependency tree
./gradlew app:dependencies
```

---

### ADB Commands

```bash
# List devices
adb devices

# Install APK
adb install path/to/app.apk

# Uninstall app
adb uninstall com.anonymous.mobile

# View logs
adb logcat

# Clear app data
adb shell pm clear com.anonymous.mobile

# Restart ADB server
adb kill-server
adb start-server
```

---

### Dependency Management

```bash
# Install all dependencies
pnpm install

# Add dependency
pnpm add <package>

# Remove dependency
pnpm remove <package>

# Update dependency
pnpm update <package>

# Check outdated
pnpm outdated

# Install with frozen lockfile (CI)
pnpm install --frozen-lockfile
```

---

### Troubleshooting Commands

```bash
# Kill Metro
npx kill-port 8081

# Clean everything
rm -rf node_modules android/build android/app/build
pnpm install
cd android && ./gradlew clean && cd ..

# Reset Metro cache
npx expo start --clear

# Reset adb
adb kill-server && adb start-server
```

---

## Key Takeaways

### Understanding the Build System

1. **Expo manages native code**
   - `expo prebuild` generates Android/iOS
   - Plugins automate configuration
   - Can customize after generation

2. **Gradle builds Android app**
   - Evaluates settings.gradle → build.gradle → app/build.gradle
   - Downloads dependencies from Maven repositories
   - Requires authentication for private repos (Mapbox)

3. **Two build approaches**
   - Local: Fast iteration, requires SDK
   - EAS: Cloud build, reproducible, no local SDK needed

4. **Configuration is spread across files**
   - app.json (Expo)
   - eas.json (EAS Build)
   - package.json (Node deps)
   - gradle files (Android build)
   - Info.plist (iOS)

5. **Mapbox requires special setup**
   - Private Maven repository
   - Authentication with secret token
   - Configuration in multiple files
   - Managed by plugin (should be automatic)

### Development Workflow

**Active Development:**

```bash
npx expo start          # Terminal 1: Metro
npx expo run:android    # Terminal 2: Build and install
# Make changes → Fast Refresh
```

**Testing/Distribution:**

```bash
eas build --profile development --platform android
# Wait for build
# Download and install APK
```

**Preparing for Release:**

```bash
eas build --profile production --platform android
# Creates AAB for Google Play Store
```

---

## Additional Resources

### Documentation

- **React Native:** https://reactnative.dev/docs/getting-started
- **Expo:** https://docs.expo.dev/
- **EAS Build:** https://docs.expo.dev/build/introduction/
- **Gradle:** https://docs.gradle.org/
- **Mapbox React Native:** https://github.com/rnmapbox/maps

### Tools

- **Android Studio:** IDE for Android development
- **VS Code:** Code editor (with React Native Tools extension)
- **Expo Dev Tools:** Browser-based development tools
- **React Native Debugger:** Standalone debugging app

### Commands Quick Reference

```bash
# Development
npx expo start
npx expo run:android
npx expo run:ios

# Building
eas build --profile development --platform android
npx expo prebuild --clean

# Debugging
adb logcat
npx expo start --clear
./gradlew app:assembleDebug --stacktrace

# Maintenance
pnpm install
rm -rf node_modules && pnpm install
cd android && ./gradlew clean
```

---

## Building Production APK

This section covers how to generate a production-ready APK file for distribution.

### Prerequisites

1. **Install EAS CLI** (if not already installed):

   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo account**:

   ```bash
   eas login
   ```

3. **Configure EAS project** (if first time):
   ```bash
   cd /home/art/Documents/eatMe_v1/apps/mobile
   eas build:configure
   ```

### Method 1: EAS Build (Recommended)

#### Build APK in the Cloud

**For Production:**

```bash
eas build --platform android --profile production
```

**For Preview/Testing:**

```bash
eas build --platform android --profile preview
```

**What happens:**

1. Code uploaded to Expo servers
2. APK built in cloud environment
3. Download link provided when complete
4. APK available in Expo dashboard

**Advantages:**

- ✅ No local Android setup needed
- ✅ Consistent build environment
- ✅ Signing handled automatically
- ✅ Build available in dashboard

**Time:** ~15-20 minutes

#### Download the APK

After build completes:

1. Click the download link in terminal, OR
2. Visit https://expo.dev/accounts/[your-account]/projects/mobile/builds
3. Download the APK file
4. Install on device: `adb install app-name.apk`

### Method 2: Local Build

#### Build APK Locally

**Requirements:**

- Android SDK installed
- Java JDK 17+
- Android Studio (for signing keys)

**Steps:**

1. **Navigate to Android directory:**

   ```bash
   cd /home/art/Documents/eatMe_v1/apps/mobile/android
   ```

2. **Build release APK:**

   ```bash
   ./gradlew assembleRelease
   ```

3. **Find APK:**
   ```bash
   # Location:
   android/app/build/outputs/apk/release/app-release.apk
   ```

**Note:** This creates an unsigned APK. For Play Store submission, you need to sign it.

### Method 3: Build Signed APK Locally

#### Generate Signing Key (First Time Only)

```bash
cd /home/art/Documents/eatMe_v1/apps/mobile/android/app
keytool -genkeypair -v -storetype PKCS12 -keystore eatme-release.keystore \
  -alias eatme-key -keyalg RSA -keysize 2048 -validity 10000
```

**Important:** Save the keystore file and passwords securely!

#### Configure Gradle for Signing

1. **Create `android/gradle.properties` (if not exists):**

   ```properties
   EATME_RELEASE_STORE_FILE=eatme-release.keystore
   EATME_RELEASE_KEY_ALIAS=eatme-key
   EATME_RELEASE_STORE_PASSWORD=your_store_password
   EATME_RELEASE_KEY_PASSWORD=your_key_password
   ```

2. **Update `android/app/build.gradle`:**

   ```gradle
   android {
       ...
       signingConfigs {
           release {
               storeFile file(EATME_RELEASE_STORE_FILE)
               storePassword EATME_RELEASE_STORE_PASSWORD
               keyAlias EATME_RELEASE_KEY_ALIAS
               keyPassword EATME_RELEASE_KEY_PASSWORD
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               ...
           }
       }
   }
   ```

3. **Build signed APK:**

   ```bash
   cd android
   ./gradlew assembleRelease
   ```

4. **Find signed APK:**
   ```bash
   android/app/build/outputs/apk/release/app-release.apk
   ```

### Build Profiles (eas.json)

Check your `eas.json` configuration:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Testing the APK

1. **Transfer to device:**

   ```bash
   adb install path/to/app.apk
   ```

2. **Or scan QR code** (if using EAS build)

3. **Or download directly on device** from Expo dashboard

### Common Issues

**Build fails with "outdated lockfile":**

```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "Update lockfile"
```

**APK won't install:**

- Check if app is already installed (uninstall first)
- Enable "Install from unknown sources" on device
- Verify APK is not corrupted

**Signing errors:**

- Verify keystore passwords are correct
- Check keystore file path
- Ensure keystore file is not corrupted

### Distribution Options

1. **Direct Installation:** Share APK file via email/drive
2. **Internal Testing:** Use EAS internal distribution
3. **Google Play Store:** Upload signed APK/AAB
4. **Firebase App Distribution:** For beta testing

### Next Steps After Building

1. **Test thoroughly** on multiple devices
2. **Check all features** work in production build
3. **Verify API connections** (Supabase, Mapbox)
4. **Test offline behavior**
5. **Monitor crash reports**

---

This guide covers the complete mobile application setup for EatMe. For specific issues not covered here, refer to the error message and online documentation for the specific tool or library involved.
