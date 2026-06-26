---
quick_id: 260625-rzx
title: Shared admin timestamp formatting helper (Mexico City timezone)
status: ready
date: 2026-06-26
---

# Quick Task 260625-rzx: Shared admin timestamp formatting helper

## Problem

Admin timestamps render inconsistently. The menu-scan "Created" column is a
**server component** (`menu-scan/page.tsx`), so `toLocaleString` with no
`timeZone` falls back to the runtime zone (Vercel = UTC) → shows UTC. The
detail page and other tables are **client** components, so they render in the
operator's *browser* zone. No single source of truth, and none pinned to
Mexico City.

## Goal

One helper that formats any timestamp in `America/Mexico_City` with a fixed
`en-US` locale, so output is identical on server and client regardless of
machine timezone. Adopt it at every admin timestamp render site.

## Task 1 — Create helper + adopt across admin

**New file:** `apps/admin/src/lib/datetime.ts`
- `ADMIN_TIME_ZONE = 'America/Mexico_City'` (UTC−6 year-round; Mexico dropped DST in 2022, IANA zone encodes it)
- `formatAdminDateTime(value)` — date + time, e.g. `Jun 25, 2026, 7:09 PM` (replaces bare `toLocaleString()`)
- `formatAdminDate(value)` — date only, e.g. `Jun 25, 2026` (replaces bare `toLocaleDateString()`)
- `formatAdminDateTimeShort(value)` — compact, no year, e.g. `Jun 25, 7:09 PM` (menu-scan list)
- All accept `string | number | Date | null | undefined`; invalid/empty → `—`

**Call sites swapped:**
1. `menu-scan/page.tsx` — delete local `formatDate`, use `formatAdminDateTimeShort`
2. `menu-scan/[jobId]/AdminJobShell.tsx:356` — `created_at` → `formatAdminDateTime`
3. `menu-scan/[jobId]/AdminJobShell.tsx:489` — `saved_at` → `formatAdminDateTime`
4. `restaurants/RestaurantsTable.tsx:161` — `created_at` → `formatAdminDate`
5. `restaurants/[id]/AdminSuspensionSection.tsx:77` — `suspendedAt` → `formatAdminDateTime`
6. `restaurants/[id]/BasicInfoSection.tsx:159` — `createdAt` → `formatAdminDateTime`
7. `audit/AuditLogTable.tsx:147` — `created_at` → `formatAdminDateTime`

**files:** the 1 new file + 6 edited files above
**verify:** `cd apps/admin && npx tsc --noEmit` clean; grep shows no remaining bare `toLocaleString()/toLocaleDateString()` in admin src (non-test)
**done:** every admin timestamp routes through the helper and renders in Mexico City time on both server and client

## Notes / non-goals
- `suppressHydrationWarning` attributes left in place (harmless; output is now deterministic so they're effectively no-ops)
- Existing `lib/timezone.ts` (coordinate→zone for open-hours) is a different concern — untouched
- Column-header tz labels (e.g. "(CDMX)") deferred — offered as optional follow-up
