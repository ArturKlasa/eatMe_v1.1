---
quick_id: 260628-fsx
slug: over-engineering-cleanup
description: Over-engineering cleanup (verified ponytail-audit) — 7 items
date: 2026-06-28
status: complete
commits: 89d5620..e952e3c (7 atomic)
---

# Quick Task 260628-fsx — Summary

Verified ponytail-audit findings against the codebase (several audit claims were
imprecise — corrected before acting), then executed inline on the main tree (mobile
tsc gate needs `node_modules`, so no worktree per project convention).

## Outcome (7 atomic commits)

| # | Commit | What | Note vs audit |
|---|--------|------|---------------|
| 1 | 89d5620 | Deleted orphan `docs/package.json` | Not in pnpm workspace/lock → deps never installed; inert, not dep bloat |
| 2 | 7a28972 | 6 scripts → `node:timers/promises` sleep | As stated; `tsc --noEmit` clean |
| 3 | a487ff6 | Removed dead `analyticsEnabled` | Not "UI-toggled" — zero consumers; kept `updatePrivacy`/`locationServices` |
| 4 | 48ced04 | Hoisted `toLocaleKey` → `utils/localeKey.ts` | It's an i18n-key builder, NOT title-case; helpers re-exports for 4 siblings |
| 5 | 56190d7 | Removed 5 dead component barrels | Top `components/index.ts` also dead (0 consumers) + sole importer of `common/` → deleted too; `map/` truly 0-consumer |
| 6 | 68e9577 | Removed stale root docs; moved `PROMPT.md` → `apps/web-portal-v2/` | v2 on ice, not abandoned → relocate not delete |
| 7 | e952e3c | Removed retired ralph/agent scaffolding | `.ralph/` was gitignored (local-only); `settings.local.json` is gitignored so its 3 perm lines were stripped locally, not committed |

## Gates
- `apps/mobile`: `npx tsc --noEmit` → exit 0 (covers items 3/4/5).
- `infra/scripts`: `npx tsc --noEmit` → clean (item 2).
- Residual-reference greps after each deletion → clean.

## Known leftovers (out of scope, not chased)
- `docs/todos/swipe-feature-inventory.md` and `swipe-removal-plan.md` reference the now-deleted
  `README_eatme.md`, `INTEGRATION_COMPLETE_SUMMARY.md`, and `.ppd-docs/*` as historical sources.
  Prose pointers in a todo/inventory doc, not code links — left as-is.
- `.gitignore` still has the `.ralph/` ignore entry (harmless; left as hygiene).
