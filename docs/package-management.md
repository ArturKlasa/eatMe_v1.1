# Package Management & Monorepo Setup

This document explains the recommended package manager (`pnpm`), workspace layout, and build orchestration with Turborepo for the EatMe monorepo. It also includes React Native Metro notes, example config files, and CI tips.

## Goals
- Reliable, deterministic dependency installs across machines and CI
- Fast installs and minimal disk usage during development
- Predictable, cached builds in CI using Turborepo
- Clear guidance for React Native (Metro) when using a workspace

## Why `pnpm`
- Content-addressable storage reduces disk usage and speeds up installs.
- Strict hoisting rules avoid implicit dependency resolution differences.
- Well-suited to workspaces and works smoothly with Turborepo caching.

## Recommended repo layout
```
/eatMe
  apps/
    mobile/
    web/
  packages/
    ui/
    types/
    services/
  infra/
  docs/
  package.json
  pnpm-workspace.yaml
  turbo.json
```

## `pnpm` workspace configuration
Create `pnpm-workspace.yaml` in the repo root:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'infra/*'
```

## Bootstrapping (local)

```bash
# install pnpm globally (one-time)
npm install -g pnpm

# install dependencies for the whole workspace
pnpm install

# add dev-only mono tooling at workspace root
pnpm -w add -D turbo
```

## Root `package.json` (suggested scripts)

```json
{
  "name": "eatme",
  "private": true,
  "workspaces": true,
  "scripts": {
    "bootstrap": "pnpm install",
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test"
  }
}
```

## Turborepo (`turbo.json`) example
Place at repo root:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false
    }
  }
}
```

Notes:
- `dependsOn: ["^build"]` means package build depends on its direct workspace dependencies' build.
- Mark deterministic tasks with `outputs` so Turbo can cache and restore them.
- For dev tasks (hot reload) disable caching.

## React Native Metro notes (pnpm workspaces)
Metro doesn't automatically resolve packages from the workspace root `node_modules`. Add a `metro.config.js` to `apps/mobile` to point Metro at the workspace folders and avoid duplicate React instances.

Example `apps/mobile/metro.config.js`:

```js
const path = require('path');

module.exports = {
  projectRoot: path.resolve(__dirname),
  watchFolders: [
    path.resolve(__dirname, '..', '..'), // repo root
    // optionally add specific packages you want to watch:
    // path.resolve(__dirname, '..', '..', 'packages', 'ui'),
  ],
  resolver: {
    // prefer local node_modules first, then workspace
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')]
  }
};
```

Additional Metro considerations:
- Avoid multiple React copies: ensure `react`/`react-native` are hoisted in root `node_modules` or resolved consistently.
- If you use custom package aliases, update Metro's `resolver.extraNodeModules`.

## CI Recommendations
- Use Turborepo's remote cache (Turbo Cloud or self-hosted S3) to speed up CI.
- In CI, run `pnpm install --frozen-lockfile` to ensure deterministic installs.
- Cache the pnpm store between CI runs if your CI supports it.

Example CI steps (high-level):

```bash
pnpm install --frozen-lockfile
pnpm -w turbo run build --filter=... --cache
pnpm -w turbo run test --filter=... --cache
```

## Troubleshooting (common issues)
- Metro cannot find a package: ensure `watchFolders` includes the workspace package or repo root.
- Duplicate `react` errors: confirm `react` and `react-native` resolve to single copies (hoisted or pinned versions).
- Dependency resolution mismatch between dev and CI: use `pnpm lockfile` and `--frozen-lockfile` in CI.

## Next steps (I can do for you)
- Add `pnpm-workspace.yaml`, `turbo.json`, and a root `package.json` `scripts` section to the repository.
- Create `apps/mobile/metro.config.js` with tailored `watchFolders` for the repo.
- Optionally configure remote Turbo cache for CI.

## References
- pnpm docs: https://pnpm.io/
- Turborepo docs: https://turbo.build/
- Metro config: https://facebook.github.io/metro/docs/configuration

---

(Generated: 2025-09-24)
