# EatMe - Food Discovery Mobile App 🍽️

A mobile-first food discovery app featuring map-based restaurant and dish exploration with AI-powered preference learning and social features.

## Project Overview

EatMe combines location-based discovery with Tinder-like preference learning to help users find restaurants and specific dishes that match their tastes. Built with React Native and featuring comprehensive filtering, social sharing, and personalized recommendations.

## Tech Stack

- **Frontend**: React Native 0.73+ with TypeScript (Expo Bare workflow)
- **Monorepo**: Turborepo with pnpm workspaces
- **Maps**: Mapbox via @rnmapbox/maps
- **Backend**: Supabase (planned for Phase 2)
- **State Management**: Zustand
- **UI Library**: NativeBase
- **Navigation**: React Navigation

## Development Environment Setup

### Prerequisites

- **Node.js**: Version 22+ (managed via Volta)
- **Package Manager**: pnpm
- **Mobile Development**: Expo CLI, EAS CLI
- **Platform**: Supports iOS and Android

### Installation

1. **Install Volta** (Node.js version manager):
```bash
curl https://get.volta.sh | bash
source ~/.bashrc
```

2. **Install Node.js and npm**:
```bash
volta install node@lts
volta install npm@latest
```

3. **Install global development tools**:
```bash
npm install -g @expo/cli eas-cli
```

4. **Clone and setup project**:
```bash
git clone <repository-url>
cd eatMe_v1
# Further setup instructions will be added as project develops
```

### Environment Verification

After setup, verify your environment:
```bash
node --version    # Should show 22.20.0 or higher
npm --version     # Should show 11.6.1 or higher
expo --version    # Should show latest version
eas --version     # Should show latest version
volta list        # Shows installed Node versions
```

## Project Structure (Planned)

```
eatMe_v1/
├── apps/
│   └── mobile/          # React Native mobile app
├── packages/
│   ├── shared/          # Shared utilities and types
│   └── ui/              # Shared UI components
├── docs/                # Project documentation
├── .ppd-docs/           # Planning and design documents
└── turbo.json           # Turborepo configuration
```

## Development Phase

**Current Status**: Phase 1 - Mobile UI Prototype with Mock Data
**Next Steps**: Monorepo setup with Turborepo and initial app structure

For detailed implementation tasks and progress, see `.ppd-docs/tasks-new/phase-1-detailed-tasks.md`.

## Key Features (Planned)

- 🗺️ **Interactive Map** - Discover restaurants and dishes nearby
- 👆 **Swipe Interface** - Tinder-like preference learning
- 🔍 **Advanced Filtering** - Cuisine, dietary restrictions, price range
- 📱 **Responsive Design** - Mobile-first with drawer navigation
- 🏷️ **Smart Tagging** - AI-powered dish categorization
- 👥 **Social Features** - Reviews, sharing, recommendations

## Documentation

- [Architecture Documentation](.ppd-docs/architecture.md)
- [Package Management Guide](docs/package-management.md)
- [Implementation Tasks](.ppd-docs/tasks-new/phase-1-detailed-tasks.md)

## Contributing

This project follows strict TypeScript and includes comprehensive documentation requirements. All code changes must include:
- Proper TypeScript types
- Inline code comments explaining complex logic
- Updated documentation when adding new features

---

*Last Updated: January 2025*
*Development Environment: Linux, Mexico City timezone*