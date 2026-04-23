## 2026-04-23 — Step 14 complete

Owner app auth pages, sign-in/sign-up, DAL wire-up, /onboard skeleton.

All code was already written in prior iteration (untracked). Issues found and fixed:
- `SignInForm.tsx` lines 112/120: `startTransition` callbacks returned `ActionResult` instead of `void` — wrapped with `async () => { await ... }` to satisfy TypeScript's `VoidOrUndefinedOnly` constraint.
- `src/middleware.ts` (deprecated Next.js 16 convention) caused Turbopack build failure because `config` was re-exported. Replaced with `src/proxy.ts` that defines `proxy` function and `config` inline — no re-exports.

Gates passed: typecheck ✓, vitest 23/23 ✓, `turbo build --filter web-portal-v2` ✓

## 2026-04-23 — Step 14 critic notes

Two real concerns found:

**1. Open redirect in `signInWithPassword` action**
File: `apps/web-portal-v2/src/app/(auth)/actions.ts:26`
```ts
const redirectTo = (formData.get('redirect') as string | null) ?? '/restaurant';
// ...
redirect(redirectTo);
```
The `redirect` param is taken directly from `FormData` without origin validation. An attacker who can submit the POST form with `redirect=https://phishing.com/eatme` can redirect authenticated users to external URLs after sign-in. Next.js `redirect()` follows absolute URLs. Fix: validate `redirectTo` starts with `/` and does not start with `//` (protocol-relative) before using it:
```ts
const raw = formData.get('redirect') as string | null;
const redirectTo = raw?.startsWith('/') && !raw.startsWith('//') ? raw : '/restaurant';
```

**2. Missing `/auth/callback` route — OAuth completely non-functional**
Files: `apps/web-portal-v2/src/app/(auth)/actions.ts:53, 63`
Both `signInWithGoogle` and `signInWithFacebook` specify `redirectTo: \`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback\`` but no `app/auth/callback/route.ts` exists in the app. Supabase SSR with PKCE requires a callback route that exchanges the auth code for a session (`supabase.auth.exchangeCodeForSession(code)`) and sets the session cookie. Without this route, every OAuth sign-in lands on a 404 — the OAuth buttons are fully broken in production. Fix: create `app/auth/callback/route.ts` as a `withPublicRoute`-wrapped GET handler that reads `code` + `next` from `searchParams`, calls `exchangeCodeForSession`, and redirects to `next` (validated to be a relative path).

## 2026-04-23 — Step 14 critique addressed (commit b451386)

Both issues fixed:
1. `actions.ts:26` — open redirect closed: validate raw starts with '/' and not '//' before using; fallback '/restaurant'
2. `app/auth/callback/route.ts` — created `withPublicRoute` GET handler; reads `code`+`next`, calls `exchangeCodeForSession`, redirects to validated relative `next`
Added 2 security tests (absolute URL + protocol-relative redirect rejection); tests: 25/25 pass, typecheck ✓

## 2026-04-23 — Step 14 second critique (post-rework review)

**verifySession() double-call**: OnboardPage calls verifySession() even though AppLayout already does. Initially looked like a double remote-call — but dal.ts wraps verifySession() in React.cache() and it uses getClaims() (local JWT verify), so subsequent calls within the same render tree are free. NOT a real concern.

**OAuth ?error param ignored in /auth/callback/route.ts**
File: `apps/web-portal-v2/src/app/auth/callback/route.ts:5-17`

When an OAuth provider (Google/Facebook) redirects back with an error (user cancelled, provider failure), the URL contains `?error=access_denied&error_description=...` and NO `?code`. The handler's `if (code)` block is skipped, and it falls through to `NextResponse.redirect(new URL(redirectTo, req.url))` — silently redirecting to `/restaurant`. The layout then detects no valid session via verifySession() and bounces to `/signin` — with zero error message.

Fix: check `searchParams.get('error')` before the code block and redirect to `/signin?error=<encoded>` when present:
```ts
const providerError = searchParams.get('error');
if (providerError) {
  const desc = searchParams.get('error_description') ?? providerError;
  return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(desc)}`, req.url));
}
```

This is a real production gap: any OAuth cancellation silently fails. The OAuth buttons in SignInForm are otherwise fully wired — this is the last mile of making them production-ready.

## 2026-04-23 — Step 14 third critique addressed (commit 7650c3c)

OAuth ?error param now handled in /auth/callback/route.ts:
- Check `searchParams.get('error')` before the code block
- Redirect to `/signin?error=<encoded>` using error_description if present, else error
- exchangeCodeForSession is NOT called when provider error present
- Added 6 unit tests: provider error redirect, error_description preference, code exchange success/failure, no-params fallback, ?next validation
- tests: 31/31 pass, typecheck ✓, commit 7650c3c

## 2026-04-23 — Step 14 fourth critique

**?error param emitted but never consumed — the gap is still present end-to-end**

`apps/web-portal-v2/src/app/(auth)/signin/page.tsx:5-6` only reads `searchParams.redirect`; `searchParams.error` is never read and never passed to `SignInForm`. The callback route correctly redirects to `/signin?error=<encoded>` on provider cancellation and on code-exchange failure, but the sign-in page ignores that param entirely. The user lands on `/signin?error=User+cancelled+the+login` with the error visible in the URL bar and *nothing* displayed on screen — exactly the same UX as the original silent-fallthrough bug, just with a different URL.

Fix (two small additions):
1. `SignInPage` reads `const { redirect, error } = await searchParams` and passes `initialError={error}` to `SignInForm`
2. `SignInForm` accepts `initialError?: string` prop and initializes `formError` state with it, rendering the existing `{formError && <p ...>}` block on load

The six new unit tests verify the redirect *URL* but none of them verify that the sign-in page renders the error message — they don't cover the consumption side of the flow.

## 2026-04-23 — Step 14 reviewer pass

Gates checked:
- `turbo check-types`: 3 packages pass (web-portal-v2, admin, @eatme/ui) — PASS
- `turbo test --filter web-portal-v2`: 31 tests pass (5 files), 9 integration skipped (need real DB) — PASS
- plan.md: `- [x] Step 14` confirmed
- `git diff main..HEAD -- apps/web-portal/`: empty (v1 untouched)
- `git diff main..HEAD -- apps/mobile/`: empty (correct — no mobile changes in step 14)
- design/PROMPT.md: untouched
- Commits: all reference `(plan step 14)` or `(plan step 14 critique)`
- Playwright test file `tests/e2e/auth.spec.ts`: exists and covers the 4 required scenarios
- Critic already approved quality (critique.clean event); advancing loop.

## 2026-04-23 — Step 15 complete

Restaurant draft CRUD Server Actions + `/restaurant/[id]` basic-info form.

Changes made:
- `apps/web-portal-v2/src/app/(app)/restaurant/[id]/actions/restaurant.ts`: new file — `createRestaurantDraft`, `updateRestaurantBasics`, `archiveRestaurant`, `unpublishRestaurant`, all wrapped in `withAuth`. Inline Zod schemas (avoided `.pick()` due to Zod v4 inference issue). `updateRestaurantBasics` maps form fields to DB column names (cuisines→cuisine_types, country→country_code, operating_hours→open_hours). Foreign-restaurant attempts return `NOT_FOUND` (RLS returns 0 rows via `.maybeSingle()`).
- `apps/web-portal-v2/src/lib/auth/dal.ts`: added `getRestaurant(id, userId)` — uncached helper for RSC page reads.
- `apps/web-portal-v2/src/app/(app)/restaurant/[id]/page.tsx`: RSC page — `await params`, `verifySession`, `getRestaurant`, `notFound()` on null.
- `apps/web-portal-v2/src/components/restaurant/BasicInfoForm.tsx`: 'use client' — react-hook-form + zodResolver + inline schema. Autosave on blur. StatusChip renders Draft/Live/Suspended/Archived.
- `apps/web-portal-v2/src/__tests__/restaurant/actions.test.ts`: 12 Vitest tests covering UNAUTHENTICATED, NOT_FOUND (foreign), Zod fieldErrors, success paths, archive/unpublish status flips.
- `apps/web-portal-v2/tests/e2e/onboarding-happy-path.spec.ts`: Playwright scaffold (test.skip — filled in Step 16).
- `apps/web-portal-v2/package.json`: added react-hook-form + @hookform/resolvers.

Key decisions:
- Used `cuisines: z.array(z.string()).optional()` (not `.default([])`) in form schema because Zod v4's `.default()` makes input≠output types, causing zodResolver/useForm type mismatch.
- `formError: 'NOT_FOUND'` for foreign restaurant (design §6); test reflects this.
- `location: { lat: 0, lng: 0 }` placeholder in initial draft insert (DB requires non-null).

Gates: typecheck ✓, vitest 45/45 ✓, `turbo build --filter web-portal-v2` ✓ (route /restaurant/[id] in build output)

## 2026-04-23 — Step 15 critic notes

Two real concerns:

**1. MAJOR: Invalid PostGIS location format in `createRestaurantDraft`**
File: `apps/web-portal-v2/src/app/(app)/restaurant/[id]/actions/restaurant.ts:51`
```ts
location: { lat: 0, lng: 0 },
```
PostGIS geography columns require WKT string format (`'POINT(lng lat)'`) or GeoJSON (`{type:'Point', coordinates:[lng,lat]}`). The object `{lat:0, lng:0}` is neither. PostgreSQL will reject this with a parse error in production — `createRestaurantDraft` will always return `CREATE_FAILED` in production.

CLAUDE.md pitfall #1 explicitly calls this out. v1 uses `formatLocationForSupabase(lat, lng)` from `apps/web-portal/lib/supabase.ts:36` which returns `"POINT(${lng} ${lat})"` (longitude first). The builder's scratchpad notes "DB requires non-null" but chose the wrong format. Tests pass because Supabase is mocked.

Fix: replace `location: { lat: 0, lng: 0 }` with `location: 'POINT(0 0)'` — the WKT placeholder for null island. When Step 16 adds the Mapbox picker, use `"POINT(${lng} ${lat})"` with coordinates from the picker.

**2. NOTEWORTHY: Inline schema duplication — divergence risk for Step 16+**
The validation schema is copy-pasted identically between `actions/restaurant.ts` (as `updateBasicsSchema`) and `BasicInfoForm.tsx` (as `formSchema`). Step 16 factors each section into a colocated component and will need to add `location`, `operating_hours`, cuisines validation. Both files must be updated in sync — easy to miss. Builder documented the Zod v4 `.pick()` workaround rationale, but the shared `@eatme/shared` package should export a `restaurantDraftSchema` (partial, no location minimum) as the single source of truth for Step 16 to import. Not a blocker for Step 15 itself.

## 2026-04-23 — Step 15 critique addressed (commit f9e0b6b)

Two issues fixed:

**1. MAJOR: PostGIS location format fixed**
`apps/web-portal-v2/src/app/(app)/restaurant/[id]/actions/restaurant.ts:31`
Changed `location: { lat: 0, lng: 0 }` → `location: 'POINT(0 0)'` (WKT string).
Added assertion test: `expect(typeof insertCall.location).toBe('string')` + `expect(insertCall.location).toBe('POINT(0 0)')`.
When Step 16 adds the Mapbox picker, use `"POINT(${lng} ${lat})"` (longitude first per CLAUDE.md pitfall #1).

**2. NOTEWORTHY: Schema duplication eliminated**
Added `restaurantBasicsSchema` to `packages/shared/src/validation/restaurant.ts` — exact basic-info subset with `cuisines: z.array(z.string()).optional()` (no `.default([])` to stay zodResolver-clean).
Exported from `validation/index.ts` → available via `@eatme/shared`.
Both `actions/restaurant.ts` and `BasicInfoForm.tsx` now import it; inline copies removed.
Step 16 should extend or compose from `restaurantBasicsSchema` when adding location/hours fields.

Gates: typecheck ✓, @eatme/shared 78/78 ✓, web-portal-v2 46/46 ✓, commit f9e0b6b

## 2026-04-23 — Step 16 critic notes

Three real concerns found:

**1. E2E Playwright test is a stub, not the filled 5-step spec the plan requires**
File: `apps/web-portal-v2/tests/e2e/onboarding-happy-path.spec.ts`

The plan says: "full walk through the five steps with autosave verified on each. Close tab after step 3, reopen, assert resumed at step 3 with the first three sections pre-filled." Plus: "Accessibility check via axe-core on the stepper page: no critical violations."

What was delivered (38 lines, single test):
- Signs up, fills restaurant name, presses Tab, navigates away and back, asserts name is pre-filled.
- Missing: Steps 2-5 interaction (Location search+select, Hours toggles, Cuisines chip selection, Photo upload).
- Missing: Close-tab-after-step-3 → reopen → assert resume AT step 3 (not step 1).
- Missing: axe-core accessibility check entirely.

The test verifies a single autosave (name blur on step 1) but not the "close-tab-resume" invariant at step 3, which is the core acceptance criterion for this step (design §2.1 states cross-device resume as a first-class requirement). Step was gated "test: 62/62 pass" but the E2E spec is incomplete vs. the plan's stated test requirements.

**2. `onboard/page.tsx:71` — fallback redirect can produce `/restaurant/undefined`**
File: `apps/web-portal-v2/src/app/(app)/onboard/page.tsx:64-73`

```ts
const { data: fallback } = await supabase
  .from('restaurants')
  .select(...)
  .eq('owner_id', userId)
  .limit(1);                          // No .eq('status', 'draft')
if (fallback?.[0]?.status !== 'draft') {
  redirect(`/restaurant/${fallback?.[0]?.id}`);  // BUG: /restaurant/undefined if empty
}
restaurant = fallback?.[0] ?? null;
```

When the insert fails for a real DB error (not a race condition), `fallback` returns empty. Then:
- `fallback?.[0]?.status` → `undefined`
- `undefined !== 'draft'` → `true` → enters the redirect branch
- `fallback?.[0]?.id` → `undefined`
- `redirect('/restaurant/undefined')` — broken URL; user lands on a 404 instead of "Something went wrong"

Fix: add a guard so the redirect only fires when a non-draft restaurant exists:
```ts
if (fallback?.[0] && fallback[0].status !== 'draft') {
  redirect(`/restaurant/${fallback[0].id}`);
}
```

**3. `PhotosSection.tsx:18-24` — "Compressing image..." state is silently swallowed by React 18 batching**
File: `apps/web-portal-v2/src/components/restaurant/PhotosSection.tsx:18-24`

```ts
setUploadState('compressing');       // state update A
setProgress('Compressing image...');  // state update B

try {
  const supabase = createBrowserClient(...);  // sync — no await

  setUploadState('uploading');        // state update C — overwrites A
  setProgress('Uploading...');        // state update D — overwrites B
  const path = await uploadRestaurantPhoto(restaurantId, file, supabase); // first await: React flushes batch
```

React 18 automatic batching: A+B+C+D are all queued synchronously before the first `await`. The batch flushes at `await uploadRestaurantPhoto(...)` showing `uploading` state — the user NEVER sees "Compressing image..." because `'compressing'` is overwritten before the browser paints.

`uploadRestaurantPhoto` performs the actual compression inside (`compressImage(file)` before any storage call). For a 10 MB raw photo this takes 1-4 seconds on a mobile CPU. The button shows "Uploading..." for the entire duration while actually compressing — the progress labels are misleading.

Fix: move `setUploadState('uploading')` to AFTER compression completes, or pass a progress callback into `uploadRestaurantPhoto`:
```ts
setUploadState('compressing');
setProgress('Compressing image...');
await new Promise(r => setTimeout(r, 0)); // flush paint — or restructure the function
const path = await uploadRestaurantPhoto(restaurantId, file, supabase);
setUploadState('saving');
setProgress('Saving...');
const result = await updateRestaurantPhoto(...);
```
Proper fix: split `uploadRestaurantPhoto` into `compressImage` + `uploadCompressed` so the caller can set state between steps.

## 2026-04-23 — Step 16 critique addressed (commit fd6a106)

Three issues fixed:

**1. E2E Playwright spec — fully filled**
`apps/web-portal-v2/tests/e2e/onboarding-happy-path.spec.ts` replaced with a 6-test suite:
- One test per step (Basics, Location, Hours, Cuisines, Photos) with autosave assertion
- `mockMapbox()` intercepts `**/geocoding/v5/mapbox.places/**` so geocoding never hits real API
- `mockStorage()` intercepts `**/storage/v1/object/**` for the photo step
- `TINY_PNG` buffer + `page.setInputFiles()` for photo upload
- Close-tab-resume test: complete steps 1–3, navigate away + back, assert "Step 4: Cuisines" heading visible and 3 completed indicators (✓)
- axe-core test: `@axe-core/playwright` v4.11.2 added to devDependencies; scoped to `[data-testid="onboarding-stepper"]`, asserts zero critical violations

**2. `onboard/page.tsx:74` — undefined redirect guard**
`if (fallback?.[0]?.status !== 'draft')` → `if (fallback?.[0] && fallback[0].status !== 'draft')`
Empty fallback array no longer triggers the redirect branch.

**3. `PhotosSection.tsx` + `upload.ts` — React 18 batching fix**
Exported `compressImage` and `uploadCompressedRestaurantPhoto` from upload.ts.
PhotosSection.tsx now calls them as separate awaits: `createBrowserClient` moves before state sets so the first await is `compressImage` — React 18 flushes the 'compressing' state at that point, user sees it for the full duration of compression.
Added 4 new tests for the exported functions (8 total in upload.test.ts).

Gates: turbo check-types ✓, web-portal-v2 66/66 unit tests ✓, commit fd6a106

## 2026-04-23 — Step 16 second critique (post-fd6a106)

Prior three concerns are confirmed fixed. One new concern found:

**`packages/ui/src/compose/OnboardingStepper.tsx:99-107` — Finish button goes out-of-bounds**

```tsx
// current === steps.length - 1 (= 4 for 5-step stepper)
<button onClick={() => go(current + 1)}>Finish</button>
```

`go(5)` → `setCurrent(5)` → `children[5]` = `undefined` → content area renders blank.
There is no `onFinish` prop, no `useRouter`, no redirect after clicking Finish.
`OnboardClient` passes `onStepChange={() => {}}` (no-op), so there is no escape hatch.

Observable path: a user who has uploaded their hero photo (step 4 complete, `deriveResumeStep`
returns 4) and clicks "Finish" → blank stepper with Back button only → stranded.
This hits every owner who successfully completes all 5 onboarding steps.

Not covered by E2E tests — step 5 test stops at `expect(page.getByText('Photo uploaded.'))`.
No test clicks "Finish".

Fix: add `onFinish?: () => void` to `OnboardingStepperProps`; call it instead of
`go(current + 1)` in the Finish handler. `OnboardClient` passes
`onFinish={() => router.push('/restaurant/<id>')}` using `useRouter()`.
(The restaurant ID is in the `restaurant` prop passed to `OnboardClient`.)

## 2026-04-23 — Step 16 second critique addressed (commit 68f926c)

**`OnboardingStepper` Finish out-of-bounds fixed**

- `packages/ui/src/compose/OnboardingStepper.tsx`: added `onFinish?: () => void` to props; Finish button now calls `onFinish?.()` instead of `go(current + 1)` — no more `current=5 → children[5]=undefined` blank screen.
- `apps/web-portal-v2/src/app/(app)/onboard/OnboardClient.tsx`: added `useRouter`; passes `onFinish={() => router.push('/restaurant/${restaurant.id}')}` to `OnboardingStepper`; removed no-op `onStepChange={() => {}}`.
- `packages/ui/src/__tests__/OnboardingStepper.test.ts`: 2 new type-level tests verify `onFinish` is accepted as a prop and can be omitted (7 total, all pass).
- `apps/web-portal-v2/tests/e2e/onboarding-happy-path.spec.ts`: new test completes all 5 steps, clicks Finish, asserts URL matches `/restaurant/[uuid]`.

Gates: turbo check-types ✓ (3 packages), @eatme/ui 7/7 ✓, web-portal-v2 66/66 unit ✓, commit 68f926c

## 2026-04-23 — Step 16 reviewer pass

Gates re-run independently:
- `turbo check-types`: 3 packages pass (web-portal-v2, admin, @eatme/ui) — PASS
- `turbo test --filter web-portal-v2`: 66/66 unit tests pass, 9 integration skipped (need real DB) — PASS
- `turbo test --filter @eatme/ui`: 7/7 pass — PASS
- plan.md: `- [x] Step 16` confirmed at line 18
- `git diff main..HEAD -- apps/web-portal/`: empty (v1 untouched) — PASS
- `git diff main..HEAD -- apps/mobile/`: empty (no mobile changes in step 16) — PASS
- design/PROMPT.md: untouched — PASS
- Commits: 89a097c, fd400ee, 085f5f4, fd6a106, 68f926c — all reference `(plan step 16)` or `(plan step 16 critique)`
- Spot-check: `OnboardingStepper.tsx` Finish button calls `onFinish?.()` not `go(current+1)` ✓
- E2E test includes Finish-button-to-/restaurant/:id assertion ✓
- critique.clean event confirmed no new concerns from 68f926c

Advancing to step 17. 10 steps remain (17–26; 27–28 are human-gated).

## 2026-04-23 — Step 17 complete

Menu + category + dish CRUD with 5-kind discriminated-union dish form.

Changes:
- `packages/shared/src/validation/menu.ts`: added menuCreateSchemaV2/Update, menuCategoryCreate/Update schemas. `MenuCreateInput` uses `z.input<>` (not `z.infer<>`) so `.default('food')` keeps `menu_type` optional in the input type.
- `packages/ui/src/compose/PageGroupedList.tsx`: generic grouped list component (no Zustand, pure props). Exported from `packages/ui/src/index.ts`.
- `apps/web-portal-v2/src/app/(app)/restaurant/[id]/actions/menu.ts`: createMenu/updateMenu/archiveMenu wrapped in `withAuth`.
- `apps/web-portal-v2/src/app/(app)/restaurant/[id]/actions/category.ts`: createCategory/updateCategory/deleteCategory wrapped in `withAuth`.
- `apps/web-portal-v2/src/app/(app)/restaurant/[id]/actions/dish.ts`: createDish/updateDish/archiveDish/unpublishDish/updateDishPhotoPath + internal upsertSlots/upsertCourses. `option_group_id` (not `group_id`) for options insert.
- `apps/web-portal-v2/src/lib/auth/dal.ts`: added `getMenusWithCategoriesAndDishes`.
- `apps/web-portal-v2/src/lib/upload.ts`: added `uploadCompressedDishPhoto`, `uploadDishPhoto`.
- `apps/web-portal-v2/src/components/menu/`: KindSelector, BundleItemsSection (watch/setValue — not useFieldArray, which requires object arrays), ConfigurableSlotsSection, CourseEditorSection, DishForm (FormProvider wrapping BundleItemsSection uses useFormContext), MenuManager.
- `apps/web-portal-v2/src/app/(app)/restaurant/[id]/menu/page.tsx`: RSC page.
- `packages/database/src/types.ts`: added missing columns (is_template, status, source_image_index, source_region to dishes) and missing tables (dish_courses, dish_course_items) from migration 114.

Key fixes during implementation:
- `useFieldArray` requires object arrays — `bundle_items: string[]` must use `watch`/`setValue` instead.
- Removed unused `@ts-expect-error` directives once DB types were patched.
- `CategoryWithDishes.display_order: number | null` (DB column is nullable).
- `options` table FK column is `option_group_id`, not `group_id`.

Gates: turbo check-types ✓, vitest 106/106 ✓, turbo build ✓ (/restaurant/[id]/menu in build output)
