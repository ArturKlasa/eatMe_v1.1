---
quick_id: 260628-fsx
slug: over-engineering-cleanup
description: Over-engineering cleanup (verified ponytail-audit) — 7 items
date: 2026-06-28
status: in-progress
mode: quick (inline, main-tree — mobile tsc gate needs node_modules, no worktree)
---

# Quick Task 260628-fsx: Over-engineering cleanup

Verified ponytail-audit findings. Each item validated against the codebase before
planning (see corrections below where the audit was imprecise). Atomic commit per item.

## Audit corrections (verified, not as originally stated)

- **Item 1** `docs/package.json` is NOT in `pnpm-workspace.yaml` globs nor `pnpm-lock.yaml`
  importers → its ~40 deps are never installed. It's inert dead config, not dep bloat.
- **Item 3** `analyticsEnabled` is NOT "UI-toggled" — zero references outside `settingsStore.ts`.
  It's touched by `updatePrivacy` (paired with `locationServices`, which IS used). Remove only
  `analyticsEnabled`; keep `updatePrivacy`/`locationServices`.
- **Item 4** the dup is `toLocaleKey()` (display-name → camelCase i18n key), NOT title-case.
  4 siblings import it from `../helpers` → re-export from helpers after hoisting.
- **Item 5** the top-level `components/index.ts` is itself dead (0 consumers) and is the ONLY
  importer of `common/index.ts` → must delete it too. `components/map/index.ts` is genuinely
  0-consumer (the `./map` hits were a different `styles/map` dir).
- **Item 7** `.ralph/` (764K) is gitignored/untracked, not tracked. Tracked footprint ≈ 3.1M.

## Tasks

1. **Delete `docs/package.json`** — orphan manifest (`name: web-portal`), no source beside it.
2. **`infra/scripts` sleep → stdlib** — 6 files: replace hand-rolled `sleep` with
   `import { setTimeout as sleep } from 'node:timers/promises'`.
3. **Drop dead `analyticsEnabled`** — `settingsStore.ts`: interface field, `updatePrivacy` Pick,
   default, persist partialize.
4. **Hoist `toLocaleKey`** — new `apps/mobile/src/utils/localeKey.ts`; `FilterComponents.tsx`
   imports it (drop local def); `helpers.ts` re-exports it (4 siblings keep `../helpers` import).
5. **Remove dead component barrels** — delete `components/{index,common,map}/index.ts`;
   inline `rating` (BasicMapScreen) and `icons` (Login + Register) to deep imports, delete those barrels.
6. **Stale root docs** — delete `README_eatme.md`, `INTEGRATION_COMPLETE_SUMMARY.md`;
   `git mv PROMPT.md apps/web-portal-v2/` (v2 implementation plan — on ice, not abandoned).
7. **Retired ralph scaffolding** — delete `.agents/ .ralph/ ralph.yml .ppd-docs/ .eval-sandbox/
   .agent/`; strip 3 dead `Bash(ralph…)` perms from `.claude/settings.local.json`.

## Gate

- After items 3/4/5: `cd apps/mobile && npx tsc --noEmit` (clean).
- Grep for residual references after each deletion (zero).
