---
quick_id: 260625-rzx
title: Shared admin timestamp formatting helper (Mexico City timezone)
status: complete
date: 2026-06-26
commit: 427970b
---

# Quick Task 260625-rzx — Summary

## What changed

Introduced `apps/admin/src/lib/datetime.ts` and routed every admin timestamp
render site through it. The helper pins both timezone (`America/Mexico_City`,
UTC−6 year-round) and locale (`en-US`), so output is identical on the server
(Vercel = UTC) and in the browser.

### New file
- `apps/admin/src/lib/datetime.ts`
  - `ADMIN_TIME_ZONE`, `formatAdminDateTime`, `formatAdminDate`, `formatAdminDateTimeShort`
  - Accept `string | number | Date | null | undefined`; invalid/empty → `—`

### Call sites adopted (7 across 6 files)
- `menu-scan/page.tsx` — removed local `formatDate`, now `formatAdminDateTimeShort` (the originating "Created" column)
- `menu-scan/[jobId]/AdminJobShell.tsx` — `created_at` + `saved_at` → `formatAdminDateTime`
- `restaurants/RestaurantsTable.tsx` — `created_at` → `formatAdminDate`
- `restaurants/[id]/AdminSuspensionSection.tsx` — `suspendedAt` → `formatAdminDateTime`
- `restaurants/[id]/BasicInfoSection.tsx` — `createdAt` → `formatAdminDateTime`
- `audit/AuditLogTable.tsx` — `created_at` → `formatAdminDateTime`

`suppressHydrationWarning` removed from the 4 sites that had it — output is now
deterministic across server/client, so the attribute was a no-op.

## Verification
- `cd apps/admin && npx tsc --noEmit` → exit 0
- grep: no bare `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` in admin src outside the helper
- Runtime check under `TZ=UTC`: `2026-06-26T01:09:30Z` → bare `1:09 AM` vs helper `Jun 25, 2026, 7:09 PM` (correct UTC−6)

## Not done (deliberate)
- Column-header tz labels (e.g. "(CDMX)") — offered as optional follow-up
- `lib/timezone.ts` (coordinate→zone for open-hours) untouched — different concern
- Commit deferred to explicit user go-ahead
