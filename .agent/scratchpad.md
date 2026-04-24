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
