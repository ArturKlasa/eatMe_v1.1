# Mapbox Configuration Restoration Guide

This document outlines the manual Mapbox SDK configurations that need to be restored after running `npx expo prebuild --clean`, as the prebuild process regenerates native files and removes custom additions.

## Overview

The Mapbox SDK requires specific configurations in native Android and iOS files for authentication and repository access. These configurations are not automatically handled by Expo and must be manually added after each prebuild.

## Required Configurations

### 1. Android Configuration

#### android/build.gradle

Add the following Mapbox repository configuration to the `allprojects.repositories` block:

```gradle
// Mapbox SDK Registry
maven {
  url 'https://api.mapbox.com/downloads/v2/releases/maven'
  authentication {
    basic(BasicAuthentication)
  }
  credentials {
    username = 'mapbox'
    // Use the token from gradle.properties
    password = project.findProperty("MAPBOX_DOWNLOADS_TOKEN") ?: ""
  }
}
```

#### android/gradle.properties

Add the following property:

```properties
# Mapbox Downloads Token for SDK access
MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg
```

### 2. iOS Configuration

#### ios/mobile/Info.plist

Add the following key-value pair inside the `<dict>` element:

```xml
<key>MBXAccessToken</key>
<string>sk.eyJ1IjoiYWtsYXNhIiwiYSI6ImNtZzMxNzdueTBldmMybHB1aHhwa3o4eGYifQ.AeDOBIHaWjsvAh4BqDw6Rg</string>
```

## Restoration Steps

1. Run `npx expo prebuild --clean` to regenerate native files
2. Apply the Android configurations above to the regenerated files
3. Apply the iOS configuration above to the regenerated Info.plist
4. Run `npx expo run:android` or `npx expo run:ios` to build and test

## Notes

- The Mapbox downloads token is used for both repository authentication and app access
- These configurations are required for the @rnmapbox/maps package to function properly
- Always restore these configurations immediately after prebuild operations
- Consider automating this process in future development cycles if possible

## Verification

After restoration, verify that:

- The app builds successfully on both platforms
- Mapbox maps display correctly
- Location services work as expected
- No Mapbox-related errors appear in the console
