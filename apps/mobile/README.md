# EatMe Mobile App

React Native mobile application with Expo Bare workflow for the EatMe food discovery platform.

## Tech Stack

- **React Native 0.81.4** - Mobile app framework
- **Expo 54** - Development platform with bare workflow
- **TypeScript** - Type safety with ES2022 target
- **React 19.1.0** - UI library

## Development Commands

### Prerequisites

Make sure you're in the monorepo root directory first.

### Start Development Server

```bash
cd apps/mobile
pnpm start
```

### Run on Platforms

```bash
# Android (requires Android Studio/emulator)
pnpm android

# iOS (requires macOS and Xcode)
pnpm ios

# Web (for testing)
pnpm web
```

## Project Structure

```
apps/mobile/
├── src/                    # Source code directory
├── android/               # Native Android project
├── ios/                   # Native iOS project
├── App.tsx               # Root application component
├── index.js              # Entry point
├── app.json              # Expo configuration
├── metro.config.js       # Metro bundler config
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## Key Features (Planned)

- 🗺️ **Mapbox Integration** - Native maps with @rnmapbox/maps
- 📱 **Navigation** - React Navigation with drawer and stack navigators
- 🎨 **UI Components** - NativeBase component library
- 🔄 **State Management** - Zustand for global state
- 📍 **Location Services** - GPS and location permissions
- 👆 **Gesture Handling** - Swipe interactions for recommendations

## Development Notes

### Expo Bare Workflow

This app uses **Expo Bare workflow** which provides:

- ✅ Full access to native iOS/Android code
- ✅ Support for native modules (like Mapbox)
- ✅ Custom native configurations
- ✅ Standard React Native CLI commands

### TypeScript Configuration

- **Target**: ES2022 for modern JavaScript features
- **JSX**: react-jsx (new JSX transform)
- **Strict Mode**: Enabled for better type safety
- **skipLibCheck**: Enabled to avoid React Native type conflicts

## Next Steps

1. **Mapbox Integration** - Add @rnmapbox/maps SDK
2. **Navigation Setup** - Configure React Navigation
3. **State Management** - Add Zustand stores
4. **UI Library** - Integrate NativeBase components
5. **Location Services** - Set up permissions and GPS

---

_This mobile app is part of the EatMe monorepo. For workspace-wide commands, see the root README.md_
