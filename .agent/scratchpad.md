## 2026-04-09 — Step 2 complete

Implemented Step 2: Type system + display service layer.

Changes made:
- `types/rating.ts`: added `note?: string` to `DishRatingInput`; changed `dishPhotos` comment to 20 pts; added `streakBonus: number` to `PointsEarned`; removed `DishRatingStats` (no consumers found)
- `dishRatingService.ts`: expanded `DishRating` with `okayPercentage`, `dislikePercentage`, `recentNotes`; updated selects; added `getRatingTier()`; updated `formatRatingText` to `"85% 👍 (47)"` format
- `restaurantRatingService.ts`: already had correct field names from prior work; no changes needed
- `RatingFlowModal.tsx`: updated photo points from 15 → 20; added `streakBonus: 0` to returned `PointsEarned`

All errors in tsc output are pre-existing (module resolution, unused vars, etc.) — none from Step 2 changes.

## 2026-04-09 — Step 3 complete

Implemented Step 3: submitInContextRating + updated submitRating.

Changes made:
- `ratingService.ts`: added `submitInContextRating` — finds/creates in-context visit (24h window), upserts dish_opinions with source='in_context', records positive interactions, awards 10+5 pts non-blocking
- `ratingService.ts`: fixed `awardPoints` dish photo bonus 15 → 20 pts
- `RatingFlowModal.tsx` already had `* 20` from Step 2 — no change needed
- `types/rating.ts` already updated in Step 2 — no change needed

Pre-existing tsc errors in ratingService.ts (lines 36, 175 — unused vars) untouched. No new errors from Step 3 changes.

## 2026-04-09 — Step 4 complete

Implemented Step 4: InContextRating component + RestaurantDetailScreen wiring.

Changes made:
- `dishRatingService.ts`: added `getUserDishOpinions(userId, dishIds)` — queries `dish_opinions`, returns `Map<dishId, DishOpinion>` (most recent per dish)
- `apps/mobile/src/components/rating/InContextRating.tsx`: new component with states: idle ("Tried it?" / highlighted opinion), selecting (3 opinion buttons), tagging (tag chips + Skip), done (animated checkmark → auto-collapse)
  - 'okay' skips tagging, submits immediately; 'liked'/'disliked' show relevant POSITIVE/NEGATIVE_DISH_TAGS
  - Calls `submitInContextRating` from `ratingService.ts`; optimistic update, reverts on error
- `RestaurantDetailScreen.tsx`:
  - Added `userDishOpinions: Map<string, DishOpinion>` state
  - `loadCategoryDishes` now calls `getUserDishOpinions` in parallel with `getDishRatingsBatch`
  - `renderMenuItem` renders `<InContextRating>` below `<DishRatingBadge>` when user is logged in

No new tsc errors introduced — all errors in RestaurantDetailScreen are pre-existing module resolution / unused var issues.

## 2026-04-09 — Step 5 complete

Implemented Step 5: Full flow enhancement — note field.

Changes made:
- `RateDishScreen.tsx`: added `note` and `noteExpanded` state; reset both on dish change; added expandable "+ Add a note" UI below tags section (only visible after opinion selected); `TextInput` with `maxLength={47}` and character counter that turns red below 10 chars; updated `handleSubmit` to pass `note: note.trim() || undefined`
- `ratingService.ts` — `saveDishOpinions`: added `note: rating.note ?? null` and `source: 'full_flow'` to the upsert payload

No new tsc errors — all errors in output are pre-existing.

## 2026-04-09 — Step 6 complete

Implemented Step 6: Updated display components.

Changes made:
- `DishRatingBadge.tsx`: added `showBadge` (default true) and `compact` (default false) props; raised minimum threshold from `totalRatings === 0` to `totalRatings < 3`; imported `getRatingTier`; prepend `🔥 ` when tier === 'top' and showBadge is true; compact mode hides tags
- `RestaurantRatingBadge.tsx`: no changes needed — field names (`foodScore`, `servicePercentage`, etc.) already correct from Step 2; no `* 100` multiplications present

All tsc errors are pre-existing — no new errors from Step 6 changes.

## 2026-04-09 — Step 7 complete

Implemented Step 7: Gamification — streaks + Trusted Taster badge.

Changes made:
- `gamificationService.ts`: new file — `updateStreak` (ISO week detection, consecutive/reset logic, milestone bonus points at 3/7/14 weeks) and `checkAndAwardTrustedTasterBadge` (20+ tagged ratings over 3+ months, idempotent)
- `ratingService.ts`: imported `updateStreak`, `checkAndAwardTrustedTasterBadge`, `StreakResult`, `BadgeResult`; updated both `submitRating` and `submitInContextRating` return types to include `streakResult`/`badgeResult`; wired `Promise.all([updateStreak, checkAndAwardTrustedTasterBadge])` as non-fatal (`.catch(() => null)`) at end of both submission functions
- `RatingCompleteScreen.tsx`: added optional `streakResult` and `badgeResult` props; renders milestone row (`🔥 N-week streak! +pts pts`) and badge row (`🏅 Trusted Taster badge earned!`) when set
- `RatingFlowModal.tsx`: imported `StreakResult`/`BadgeResult`; added state for both; updated `onComplete` prop type to return `{ streakResult?, badgeResult? } | void`; stores results from `onComplete`, passes to `RatingCompleteScreen`
- `BasicMapScreen.tsx`: `handleRatingComplete` now returns `{ streakResult, badgeResult }` from `submitRating`

All tsc errors are pre-existing — no new errors from Step 7 changes.

## 2026-04-23 — Step 19 critique notes

Reviewed commit 8911267 (menu-scan-worker Edge Function + pg_cron + OpenAI).

**Concern 1 — Missing `result_json` assertion in happy-path Deno test**
File: `infra/supabase/functions/menu-scan-worker/test.ts`

The `makeSupaMock` signature captures `(id: string, result: unknown)` in `onComplete`, but the happy-path test wires `onComplete: id => completed.push(id)` — the `result` argument is discarded. The plan requirement at step 19 test requirements explicitly says "assert the `menu_scan_jobs` row transitions `pending → processing → needs_review` **and `result_json` has the canned payload**."

If `processJobs` were to pass `null` or the raw `completion` object instead of `parsed` to `complete_menu_scan_job`, this test would still pass. The forwarding of the correct extracted payload to `complete_menu_scan_job` is untested.

Fix: change `onComplete: id => completed.push(id)` to capture both args, then assert `assertEquals(capturedResult, CANNED_RESULT)`.

**Concern 2 — Duplicated `PRIMARY_PROTEINS` in Edge Function has no sync test**
Files:
- `infra/supabase/functions/menu-scan-worker/index.ts` lines 13–24: hardcoded 11-value array
- `packages/shared/src/logic/protein.ts` lines 1–13: canonical source

The Edge Function comment says "Canonical source: packages/shared/src/validation/menuScan.ts" but the actual protein list canonical source is `protein.ts`. The two lists are identical today, but there is no automated check that keeps them in sync. If `protein.ts` gains a 12th value (e.g., a future migration adds `'tofu'`), the worker's `z.enum(PRIMARY_PROTEINS)` would reject dishes with that protein as a schema parse error — silently transitioning real jobs to `failed` with no human-visible mismatch.

A simple Vitest test in `packages/shared` that imports the Edge Function's LOCAL `PRIMARY_PROTEINS` export and does `assertEquals(EDGE_FN_LIST, PRIMARY_PROTEINS)` would catch this. Alternatively, `index.ts` could import from the shared bundle via a relative build artifact instead of maintaining a manual copy.

## 2026-04-23 — Step 19 critique addressed (commit 1aba5d0)

Both critique concerns resolved:

1. **result_json assertion**: Happy-path test now captures the `result` arg from `onComplete` callback and asserts `capturedResult === CANNED_RESULT`. Previously only the job id was pushed to the `completed` array, leaving the actual payload forwarding untested.

2. **PRIMARY_PROTEINS sync test**: `PRIMARY_PROTEINS` exported from `index.ts`; new Deno test imports canonical list from `../../../../packages/shared/src/logic/protein.ts` and asserts sorted equality. A future 12th protein in `protein.ts` will now cause the sync test to fail rather than silently break production jobs.

Gates: `turbo check-types` pass, `turbo test --filter @eatme/shared` pass (93 tests). Deno not installed locally (consistent with original step 19 commit).

## 2026-04-23 — Step 19 second critique addressed (commit 68481df)

Both earlier concerns addressed. New review (second critique) surfaces two more concerns — both addressed in commit 68481df.

**Concern 1 — Design fidelity: no Authorization check on the HTTP trigger**
File: `infra/supabase/functions/menu-scan-worker/index.ts` line 222

```typescript
Deno.serve(async _req => {
```

The request is completely ignored — `_req` is never read. The design at §3.1 and §3.2 explicitly states: "The new `menu-scan-worker` Edge Function is only ever called by `pg_cron` — it is **not a public endpoint**" and "exposing the function as a public trigger would let anonymous callers spin up work."

The anon key is public (embedded in the mobile app). Any mobile user can call `POST /functions/v1/menu-scan-worker` with the anon key and trigger up to `MAX_PER_TICK=3` OpenAI calls per request. The `pg_cron` migration sends the service-role key in `Authorization: Bearer ...`, but the handler never checks it.

Fix: verify the incoming Authorization header matches the service role key before calling `processJobs`:
```typescript
Deno.serve(async req => {
  const authHeader = req.headers.get('Authorization');
  const expectedToken = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  if (authHeader !== expectedToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... existing processJobs logic
});
```

## 2026-04-23 — Step 20 complete

Implemented Step 20: Owner menu-scan upload UI.

Files added/modified:
- `src/lib/upload.ts`: added `uploadMenuScanPage(restaurantId, file, pageNumber, supabase)` → compresses via `compressImage`, uploads to `menu-scan-uploads/<restaurantId>/<uuid>.jpg`, returns `{bucket, path, page}`
- `src/lib/auth/dal.ts`: added `getMenuScanJobs(restaurantId, userId)` — ownership-guards via restaurants query, then fetches `menu_scan_jobs` rows ordered newest first
- `src/app/(app)/restaurant/[id]/actions/menuScan.ts`: new `createMenuScanJob` Server Action wrapped in `withAuth`; checks restaurant ownership → validates `menuScanJobInputSchema` → inserts `menu_scan_jobs` row with `status='pending'` → returns `{ok:true, data:{jobId}}`
- `src/app/(app)/restaurant/[id]/menu-scan/page.tsx`: RSC page — verifies session + ownership, lists previous scan jobs with status + Review links
- `src/app/(app)/restaurant/[id]/menu-scan/MenuScanUploadForm.tsx`: client component — drag-and-drop zone + hidden file input (JPEG/PNG/HEIC, up to 20 files), keyboard-navigable (`role=button`, Enter/Space trigger), per-file `uploadMenuScanPage` loop, then `createMenuScanJob`, then `router.push` to review page
- `src/__tests__/restaurant/upload.test.ts`: added 3 `uploadMenuScanPage` tests (correct compression options, path format, page passthrough, error throw)
- `src/__tests__/restaurant/menu-scan-actions.test.ts`: new — 6 tests for `createMenuScanJob` (UNAUTHENTICATED, FORBIDDEN, 0/21 images Zod bounds, success, CREATE_FAILED, insert payload shape)
- `tests/e2e/menu-scan-happy-path.spec.ts`: new Playwright scaffold — skipped without `E2E_SERVICE_ROLE_KEY`; wires full upload → DB verification path for Step 26

Gates: `turbo check-types` pass (whole monorepo), `vitest run` 122 pass + 9 skipped (pre-existing), `turbo build --filter web-portal-v2` clean (route `/restaurant/[id]/menu-scan` appears in build output).

**Concern 2 (secondary) — Empty-images jobs treated as retryable, not fast-failed**
File: `infra/supabase/functions/menu-scan-worker/index.ts` line 183, 211

`if (!input?.images?.length) throw new Error('Job has no images in input')` falls through to the non-`isBadRequest` branch: `p_max_attempts=3`. A job with no images is permanently broken (the owner can't add images to an existing job row), so it should fast-fail like `BadRequestError` (`p_max_attempts=1`). In practice the Server Action gate (`menuScanJobInputSchema` requires ≥1 image) prevents this job from being created via normal flow, but a direct DB insert or a future Service Action bug would waste 3 attempts + 3 OpenAI fallback calls before failing.

Fix: add `|| e.message.includes('Job has no images')` to the `isBadRequest` condition, or check for the missing-images case before the try/catch and fail immediately without an OpenAI call.

## 2026-04-23 — Step 20 second critique addressed (commit da81149)

Three concerns from second critique all resolved:

1. **Storage cleanup on partial upload failure**: `cleanupUploaded()` helper in `handleSubmit` calls `supabase.storage.from('menu-scan-uploads').remove(images.map(img => img.path))` on both the catch path (upload throws mid-loop) and the `!result.ok` path (job insert fails). Orphaned objects are cleaned up before surfacing error to user.

2. **Bucket field constrained to literal**: `menuScanJobInputSchema` in `packages/shared/src/validation/menuScan.ts` now uses `bucket: z.literal('menu-scan-uploads')` — a caller cannot point the worker at an arbitrary Storage bucket. TypeScript propagation: `MenuScanJobInput`, `uploadMenuScanPage` return type, form `images` array type, and test fixtures all updated.

3. **Safe type cast**: `supabase as unknown as StorageClient` replaces `supabase as never` in `MenuScanUploadForm.tsx`. `StorageClient` is now exported from `upload.ts`.

New test: `createMenuScanJob` rejects `bucket: 'dish-photos'` (cast as `never` to bypass TS, testing runtime Zod rejection). Gates: `turbo check-types` pass, `vitest run` 123 pass + 9 skipped.

## 2026-04-23 — Step 20 third critique (commit da81149)

**Concern — `cleanupUploaded()` awaited without `.catch()` in both error paths; UI can freeze when storage is unreachable**
File: `apps/web-portal-v2/src/app/(app)/restaurant/[id]/menu-scan/MenuScanUploadForm.tsx` lines 93, 88 (after patch)

`cleanupUploaded()` calls `supabase.storage.from('menu-scan-uploads').remove(...)`. The Supabase storage JS client wraps `StorageError` instances into `{data,error}` but re-throws raw network errors (e.g., `TypeError: Failed to fetch`). When Supabase Storage is unreachable — exactly the condition that caused the original upload to fail — `remove()` will also reject with a network error.

In the `catch (err)` block:
```typescript
} catch (err) {
  await cleanupUploaded();     // throws if storage is down
  setErrorMessage(...);        // never runs
  setPhase('error');           // never runs — UI frozen at "Uploading images…"
}
```
`setPhase('error')` and `setErrorMessage()` are never called. The component stays in `uploading` phase with the spinner indefinitely — no error message, no way for the user to retry without a hard page refresh.

The same structural issue exists in the `!result.ok` path (line 88), though it is less likely to trigger there (uploads already succeeded, so storage was reachable).

Fix: cleanup is best-effort — use `.catch(() => {})` in both paths:
```typescript
} catch (err) {
  await cleanupUploaded().catch(() => {});
  setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
  setPhase('error');
}
```
And in the `!result.ok` branch:
```typescript
await cleanupUploaded().catch(() => {});
```

## 2026-04-23 — Step 20 third critique addressed (commit bc22cd7)

`cleanupUploaded()` in `MenuScanUploadForm.tsx` now uses `.catch(() => {})` in both error paths (line 90 `!result.ok` branch and line 98 `catch (err)` block). Storage errors during cleanup no longer block `setPhase('error')` from running. Gates: `turbo check-types` pass, `vitest run` 123 pass + 9 skipped.

## 2026-04-23 — Step 20 critique (commits ceaebd6 + b6d0ae2)

Three concerns flagged — NOT previously noted in scratchpad.

**Concern 1 — No storage cleanup on partial upload failure or job insert failure**
File: `apps/web-portal-v2/src/app/(app)/restaurant/[id]/menu-scan/MenuScanUploadForm.tsx` lines 66–84

The sequential upload loop does not clean up already-uploaded objects if a later upload throws or if `createMenuScanJob` returns `{ok:false}`. Example: 5 images, image 3 throws — objects 1 and 2 are orphaned in `menu-scan-uploads/<restaurantId>/` with no job row. The worker only processes jobs from `claim_menu_scan_job`; orphaned objects accumulate silently. Similarly, if all uploads succeed but the job insert returns `CREATE_FAILED`, all N objects are orphaned. No cleanup path exists in the UI or the worker.

Fix: on error path, iterate over `images` already pushed and call `supabase.storage.from('menu-scan-uploads').remove(images.map(i => i.path))` before surfacing the error to the user.

**Concern 2 — `bucket` field not constrained to `'menu-scan-uploads'`**
File: `packages/shared/src/validation/menuScan.ts` line 12

`menuScanJobInputSchema` uses `bucket: z.string()`. A caller can supply any bucket name (e.g., `'dish-photos'`, `'restaurant-photos'`). The Server Action inserts the raw client value; the worker runs with service-role and calls `supabase.storage.from(image.bucket)` — so the worker would attempt to read from an arbitrary Storage bucket named by the client. Cross-tenant data access: owner A can trick the worker into reading storage paths belonging to restaurant B.

Fix: `bucket: z.literal('menu-scan-uploads')` in `menuScanJobInputSchema`.

**Concern 3 — `supabase as never` type cast bypasses type safety**
File: `apps/web-portal-v2/src/app/(app)/restaurant/[id]/menu-scan/MenuScanUploadForm.tsx` line 72

`uploadMenuScanPage(restaurantId, files[i], i + 1, supabase as never)` uses the bottom type to suppress the type mismatch between the full Supabase browser client and `upload.ts`'s hand-rolled `StorageClient` interface. TypeScript won't catch any future divergence. Replace with `supabase as unknown as StorageClient` (a safe two-step cast that still surface-checks the target type) or align `StorageClient` with `{ storage: ReturnType<SupabaseClient['storage']['from']> }`.

## 2026-04-23 — Step 20 reviewer verification

Gates run independently:
- `turbo check-types`: PASS (3 tasks, 3 cached, 74ms)
- `turbo test --filter web-portal-v2`: PASS — 123 tests pass, 9 skipped (pre-existing integration skips); 12/14 test files pass; upload.test.ts (15 tests) and menu-scan-actions.test.ts (8 tests) confirm Step 20 requirements
- plan.md: `- [x] Step 20` confirmed ticked
- Commits: `ceaebd6 feat(v2)`, `b6d0ae2 chore(plan)`, `da81149 refactor(v2,shared)`, `bc22cd7 refactor(v2)` — all reference plan step 20; no step.next until critique.clean resolved
- v1 untouched: `git diff main..HEAD -- apps/web-portal/` is empty
- mobile untouched: `git diff main..HEAD -- apps/mobile/` is empty
- git status clean (only .agent/scratchpad.md modified)
- Spot check: `/restaurant/[id]/menu-scan/` directory exists with page.tsx + MenuScanUploadForm.tsx; `uploadMenuPage` covers menu-scan-uploads bucket + compression options; `createMenuScanJob` tests cover 0/21 images Zod bounds + FORBIDDEN + payload shape

All gates PASS. Advancing to Step 21.

## 2026-04-23 — Step 24 complete

Implemented Step 24: Admin menu-scan power tool — batch PDF upload, raw inspector, replay.

Files added/modified:
- `apps/admin/src/lib/auth/dal.ts`: added `getAdminMenuScanJobs`, `getAdminMenuScanJobById`, `getAdminRestaurantOptions` + their types (`AdminMenuScanJobRow`, `AdminMenuScanJobDetail`, `RestaurantOption`)
- `apps/admin/src/lib/upload.ts`: new — `compressImage` + `uploadMenuScanPage` + `StorageClient` (adapted from web-portal-v2; same API)
- `apps/admin/src/app/(admin)/menu-scan/actions/menuScan.ts`: new — `replayMenuScan` (withAdminAuth, creates new job with model_hint, fires worker directly, audit log), `adminUpdateJobStatus` (flip needs_review↔failed, audit log), `adminCreateMenuScanJob` (admin-bypass job insert, fires worker)
- `apps/admin/src/app/(admin)/menu-scan/page.tsx`: RSC queue view of all jobs (admin sees all owners), status filter tabs, pagination, `AdminBatchUploadForm` above table
- `apps/admin/src/app/(admin)/menu-scan/AdminBatchUploadForm.tsx`: client — PDF rasterisation via dynamic pdfjs-dist import (each page → canvas → JPEG), per-file restaurant picker, grouped upload by restaurant, calls `adminCreateMenuScanJob` per group
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/page.tsx`: RSC job detail (404 on missing)
- `apps/admin/src/app/(admin)/menu-scan/[jobId]/AdminJobShell.tsx`: client — Realtime subscription (same pattern as ScanReviewShell), status panel + flip buttons (needs_review↔failed), raw JSON inspector (result_json via JSON.stringify, dish count + avg confidence), replay panel with model selector (gpt-4o-2024-11-20 or gpt-4o-mini)
- `apps/admin/src/__tests__/menu-scan/replay-menu-scan.test.ts`: 7 tests (auth, validation, happy path, audit log, best-effort worker)
- `apps/admin/src/__tests__/menu-scan/raw-inspector.test.ts`: 7 tests (adminUpdateJobStatus auth/validation/happy path + JSON identity unit tests)
- `apps/admin/tests/e2e/menu-scan-power-tool.spec.ts`: Playwright scaffold (skipped without E2E_SERVICE_ROLE_KEY)

Gates: `turbo check-types` PASS (whole monorepo), `turbo test --filter admin` PASS (54 tests). Step 24 ticked in plan.md.
Commits: 4579bb8 feat(v2), 09d90e2 chore(plan).

Next unchecked step: Step 25 — Admin bulk import (CSV + Google Places) + admin_audit_log viewer.
