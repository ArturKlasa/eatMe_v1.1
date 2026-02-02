# EatMe Development Commands Reference

Complete reference guide for all terminal commands used in the EatMe project.

## Table of Contents

- [Package Management (pnpm)](#package-management-pnpm)
- [Git Commands](#git-commands)
- [Supabase](#supabase)
- [Mobile Development (Expo)](#mobile-development-expo)
- [Database Migrations](#database-migrations)
- [General Development](#general-development)

---

## Package Management (pnpm)

| Command                             | What It Does                                | When To Use                                                                                | Example                                           |
| ----------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `pnpm install`                      | Installs all dependencies from package.json | After cloning repo, after pulling changes with new dependencies, after adding new packages | `cd /home/art/Documents/eatMe_v1 && pnpm install` |
| `pnpm add <package>`                | Adds a package to root workspace            | Installing packages at monorepo root level                                                 | `pnpm add typescript --save-dev`                  |
| `pnpm add -F <workspace> <package>` | Adds a package to specific workspace        | Installing packages in specific app (mobile, web-portal)                                   | `pnpm add -F mobile expo-sharing`                 |
| `pnpm dev`                          | Starts all apps in development mode         | Running entire monorepo in development                                                     | `cd /home/art/Documents/eatMe_v1 && pnpm dev`     |
| `pnpm build`                        | Builds all apps                             | Before deployment, testing production builds                                               | `pnpm build`                                      |
| `pnpm lint`                         | Runs ESLint on all packages                 | Checking code quality, before committing                                                   | `pnpm lint`                                       |
| `turbo dev --filter=<app>`          | Runs specific app only                      | Developing single app without starting others                                              | `turbo dev --filter=web-portal`                   |
| `turbo clean`                       | Clears Turbo cache                          | Build behaving strangely, need fresh build                                                 | `turbo clean`                                     |

---

## Git Commands

| Command                               | What It Does                                      | When To Use                                     | Example                                          |
| ------------------------------------- | ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `git status`                          | Shows current branch and uncommitted changes      | Checking what files changed before committing   | `git status`                                     |
| `git add -A`                          | Stages all changes (new, modified, deleted files) | Before committing, to include all changes       | `git add -A`                                     |
| `git add <file>`                      | Stages specific file                              | When you want to commit only certain files      | `git add src/services/eatTogetherService.ts`     |
| `git commit -m "message"`             | Creates commit with message                       | After staging changes, to save snapshot         | `git commit -m "feat: Add Eat Together feature"` |
| `git commit -m "message" --no-verify` | Commits without running hooks                     | When hooks are blocking commit (use sparingly)  | `git commit -m "fix: Quick hotfix" --no-verify`  |
| `git log`                             | Shows commit history                              | Viewing past commits, checking who changed what | `git log --oneline --graph`                      |
| `git diff`                            | Shows unstaged changes                            | Reviewing what changed before staging           | `git diff`                                       |
| `git diff --staged`                   | Shows staged changes                              | Reviewing what will be committed                | `git diff --staged`                              |
| `git branch`                          | Lists branches                                    | Checking current branch, viewing all branches   | `git branch -a`                                  |
| `git checkout <branch>`               | Switches to branch                                | Changing branches                               | `git checkout main`                              |
| `git checkout -b <branch>`            | Creates and switches to new branch                | Starting new feature                            | `git checkout -b feature/eat-together`           |
| `git pull`                            | Fetches and merges remote changes                 | Getting latest changes from remote              | `git pull origin main`                           |
| `git push`                            | Pushes commits to remote                          | Sharing commits with team, backing up work      | `git push origin main`                           |
| `git stash`                           | Temporarily saves changes                         | Need to switch branches without committing      | `git stash`                                      |
| `git stash pop`                       | Restores stashed changes                          | Applying saved changes after switching back     | `git stash pop`                                  |
| `git reset --hard HEAD`               | Discards all changes                              | Abandoning all changes, start fresh             | `git reset --hard HEAD` (⚠️ destructive)         |
| `git clean -fd`                       | Removes untracked files                           | Cleaning up temp files, build artifacts         | `git clean -fd` (⚠️ destructive)                 |

---

## Supabase

| Command                            | What It Does                             | When To Use                             | Example                                                     |
| ---------------------------------- | ---------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `supabase init`                    | Initializes Supabase project             | First time setting up Supabase locally  | `cd infra/supabase && supabase init`                        |
| `supabase start`                   | Starts local Supabase instance           | Developing with local database          | `supabase start`                                            |
| `supabase stop`                    | Stops local Supabase instance            | Done with local development             | `supabase stop`                                             |
| `supabase db reset`                | Resets database to migration state       | Testing migrations, fixing broken state | `supabase db reset`                                         |
| `supabase migration new <name>`    | Creates new migration file               | Adding new database schema changes      | `supabase migration new add_eat_together_tables`            |
| `supabase db push`                 | Applies migrations to remote database    | Deploying schema changes to production  | `supabase db push`                                          |
| `supabase functions deploy <name>` | Deploys Edge Function                    | Deploying backend logic to Supabase     | `supabase functions deploy group-recommendations`           |
| `supabase functions serve`         | Runs Edge Functions locally              | Testing Edge Functions before deploy    | `supabase functions serve`                                  |
| `supabase gen types typescript`    | Generates TypeScript types from database | After schema changes, to update types   | `supabase gen types typescript --local > types/database.ts` |

---

## Mobile Development (Expo)

| Command                                              | What It Does                         | When To Use                                              | Example                                              |
| ---------------------------------------------------- | ------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------- |
| `npx expo start`                                     | Starts Metro bundler                 | Daily development, after code changes                    | `cd apps/mobile && npx expo start`                   |
| `npx expo start --dev-client`                        | Starts Metro for development build   | When using custom native modules (Mapbox)                | `npx expo start --dev-client`                        |
| `npx expo run:android`                               | Builds and runs on Android           | First time, after native dependency changes              | `cd apps/mobile && npx expo run:android`             |
| `npx expo run:ios`                                   | Builds and runs on iOS               | First time, after native dependency changes (macOS only) | `npx expo run:ios`                                   |
| `npx expo prebuild`                                  | Generates native android/ios folders | Setting up bare workflow, after ejecting                 | `npx expo prebuild`                                  |
| `eas build --profile development --platform android` | Builds development client via EAS    | Creating development build for testing                   | `eas build --profile development --platform android` |
| `eas build --profile production --platform android`  | Builds production APK/AAB            | Creating release build for deployment                    | `eas build --profile production --platform android`  |
| `adb devices`                                        | Lists connected Android devices      | Checking if device/emulator is connected                 | `adb devices`                                        |
| `adb shell pm clear <package>`                       | Clears app data                      | Resetting app state during testing                       | `adb shell pm clear com.eatme.mobile`                |
| `adb uninstall <package>`                            | Uninstalls app from device           | Removing app before fresh install                        | `adb uninstall host.exp.exponent`                    |

---

## Database Migrations

| Command                             | What It Does                          | When To Use                                 | Example                                                                         |
| ----------------------------------- | ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Run migration in Supabase Dashboard | Executes SQL migration                | Applying schema changes to hosted database  | Copy SQL from `infra/supabase/migrations/001_*.sql` → Paste in SQL Editor → Run |
| Verify migration                    | Checks migration applied successfully | After running migration, to confirm success | Check Tables list in Dashboard, query data                                      |
| Rollback migration                  | Manually undoes migration             | Migration failed or has issues              | Write reverse SQL manually, test locally first                                  |

**Migration File Naming Convention:**

- Format: `00X_descriptive_name.sql`
- Example: `018_eat_together_feature.sql`
- Always sequential numbering
- Keep descriptions clear and concise

---

## General Development

| Command                       | What It Does                  | When To Use                             | Example                           |
| ----------------------------- | ----------------------------- | --------------------------------------- | --------------------------------- |
| `pwd`                         | Prints working directory      | Checking current location in terminal   | `pwd`                             |
| `cd <path>`                   | Changes directory             | Navigating file system                  | `cd /home/art/Documents/eatMe_v1` |
| `ls`                          | Lists files in directory      | Viewing folder contents                 | `ls -la`                          |
| `mkdir <name>`                | Creates directory             | Creating new folders                    | `mkdir src/screens/eatTogether`   |
| `rm -rf <path>`               | Removes directory recursively | Deleting folders/files (⚠️ destructive) | `rm -rf node_modules`             |
| `cat <file>`                  | Displays file contents        | Quick file viewing                      | `cat .env`                        |
| `grep <pattern> <file>`       | Searches for pattern in files | Finding specific text in files          | `grep "API_KEY" .env`             |
| `find <path> -name <pattern>` | Finds files by name           | Locating files in project               | `find . -name "*.ts"`             |
| `ps aux \| grep <process>`    | Lists running processes       | Finding running apps/servers            | `ps aux \| grep node`             |
| `kill -9 <pid>`               | Force kills process           | Stopping hung processes                 | `kill -9 12345`                   |
| `chmod +x <file>`             | Makes file executable         | Setting up scripts                      | `chmod +x scripts/deploy.sh`      |

---

## Android Emulator Management

| Command                                                  | What It Does                            | When To Use                              | Example                                                                                    |
| -------------------------------------------------------- | --------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `~/Android/Sdk/emulator/emulator -list-avds`             | Lists available Android Virtual Devices | Checking AVD names before launching      | `~/Android/Sdk/emulator/emulator -list-avds`                                               |
| `~/Android/Sdk/emulator/emulator -avd <name>`            | Starts specific AVD                     | Launching emulator manually              | `~/Android/Sdk/emulator/emulator -avd Pixel_3a_API_34_extension_level_7_x86_64`            |
| `~/Android/Sdk/emulator/emulator -avd <name> -wipe-data` | Starts AVD with wiped data              | Clearing emulator storage, fixing issues | `~/Android/Sdk/emulator/emulator -avd Pixel_3a_API_34_extension_level_7_x86_64 -wipe-data` |

---

## Environment & Configuration

| Command                 | What It Does                | When To Use                                | Example                      |
| ----------------------- | --------------------------- | ------------------------------------------ | ---------------------------- |
| `source .env`           | Loads environment variables | Making env vars available in current shell | `source .env`                |
| `export VAR=value`      | Sets environment variable   | Temporarily setting env vars               | `export NODE_ENV=production` |
| `echo $VAR`             | Prints environment variable | Checking env var value                     | `echo $SUPABASE_URL`         |
| `env \| grep <pattern>` | Lists environment variables | Finding specific env vars                  | `env \| grep EXPO`           |

---

## Troubleshooting Commands

| Command                                | What It Does                    | When To Use                          | Example                                |
| -------------------------------------- | ------------------------------- | ------------------------------------ | -------------------------------------- |
| `pnpm store prune`                     | Cleans pnpm store               | Store errors, freeing disk space     | `pnpm store prune`                     |
| `rm -rf node_modules && pnpm install`  | Fresh dependency install        | Dependency issues, corrupted modules | `rm -rf node_modules && pnpm install`  |
| `adb logcat`                           | Shows Android device logs       | Debugging Android crashes            | `adb logcat \| grep ReactNative`       |
| `watchman watch-del-all`               | Clears Metro bundler cache      | Metro caching stale files            | `watchman watch-del-all`               |
| `npx react-native start --reset-cache` | Starts Metro with cleared cache | Bundler cache issues                 | `npx react-native start --reset-cache` |

---

## Quick Reference: Common Workflows

### Starting Development Session

```bash
cd /home/art/Documents/eatMe_v1
git pull origin main
pnpm install
cd apps/mobile
npx expo start --dev-client
# Press 'a' to open on Android
```

### Making Changes & Committing

```bash
# Make code changes...
git status
git add -A
git commit -m "feat: Add new feature"
git push origin main
```

### Running Database Migration

```bash
# 1. Create migration file
cd infra/supabase/migrations
# Create: 021_my_changes.sql

# 2. Test locally (if using local Supabase)
supabase db reset

# 3. Apply to production
# Open Supabase Dashboard → SQL Editor
# Copy SQL from migration file → Run
```

### Deploying Edge Function

```bash
cd infra/supabase
supabase functions deploy group-recommendations --no-verify-jwt
```

### Fixing Emulator Storage Issues

```bash
# Option 1: Clear app data
adb shell pm clear host.exp.exponent

# Option 2: Uninstall and reinstall
adb uninstall host.exp.exponent
cd apps/mobile
npx expo run:android

# Option 3: Wipe emulator
~/Android/Sdk/emulator/emulator -avd Pixel_3a_API_34_extension_level_7_x86_64 -wipe-data
```

---

## Notes

### ⚠️ Destructive Commands (Use with caution)

- `git reset --hard`
- `git clean -fd`
- `rm -rf`
- `kill -9`
- `emulator -wipe-data`

### 💡 Best Practices

- Always run `git status` before `git add`
- Test migrations locally before production
- Commit frequently with clear messages
- Use `--filter` to run specific apps in monorepo
- Check `git diff` before committing
- Read error messages carefully - they're usually helpful!

### 🔗 Environment Prefixes

- Root workspace: `VITE_*`
- Mobile app: `EXPO_PUBLIC_*`
- Web portal: `NEXT_PUBLIC_*`
- Supabase: `SUPABASE_*`

---

_Last Updated: February 1, 2026_
