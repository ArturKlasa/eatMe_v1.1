# REV-06: web-forms-zod — Web portal RHF + Zod review

## Scope reviewed

- `packages/shared/src/validation/restaurant.ts:1-134` (shared schemas)
- `packages/shared/src/validation/index.ts:1-16`
- `packages/shared/src/types/restaurant.ts:1-199` (consumer types)
- `apps/web-portal/app/onboard/basic-info/page.tsx:1-161`
- `apps/web-portal/app/onboard/menu/page.tsx:1-562`
- `apps/web-portal/app/onboard/review/page.tsx:1-402`
- `apps/web-portal/components/admin/RestaurantForm.tsx:1-663`
- `apps/web-portal/components/forms/DishFormDialog.tsx:1-185`
- `apps/web-portal/components/forms/dish/*.tsx` (10 field components)
- `apps/web-portal/components/forms/OperatingHoursEditor.tsx:1-142`
- `apps/web-portal/components/onboarding/{BasicInfoFields,LocationSection,types}.tsx`
- `apps/web-portal/lib/hooks/useDishFormData.ts:1-436`
- `apps/web-portal/lib/hooks/useRestaurantDraft.ts:1-242`
- `apps/web-portal/lib/storage.ts:1-89`
- `apps/web-portal/lib/import-validation.ts:1-99`
- `apps/web-portal/components/LocationFormSection.tsx:1-60` (LocationData shape)
- Test mocks: `apps/web-portal/test/{BasicInfoPage,DishFormDialog}.test.tsx`

## Findings

### REV-06-a: Onboarding basic-info form bypasses Zod entirely
- Severity: high
- Category: correctness
- Location: `apps/web-portal/app/onboard/basic-info/page.tsx:27-29, 46-79`
- Observation: `useForm<BasicInfoFormData>({ defaultValues: () => Promise.resolve(loadFormDefaults(user?.id)) })` declares no resolver. `onSubmit` hand-validates `!data.name || !data.location?.address` and array length of `selectedCuisines` via ad-hoc `toast.error` calls.
- Why it matters: The shared `basicInfoSchema` (`packages/shared/src/validation/restaurant.ts:3-24`) already encodes name min(2), phone regex, website `.url()`, lat/lng bounds, cuisine min(1). None of those run on the primary onboarding step — a user can submit a 1-char name, a malformed phone, or a non-URL website and have it silently persisted to the draft + later written to Supabase. Field-level error UX is also lost (no `errors.phone?.message` path).
- Suggested direction: Wire `resolver: zodResolver(basicInfoSchema.merge(operationsSchema))` (or a new combined form schema) and surface per-field errors instead of a single toast. Requires aligning the local `BasicInfoFormData` shape with the merged schema (see REV-06-b).
- Confidence: confirmed
- Evidence: No `zodResolver` import in the file; `grep zodResolver apps/web-portal/app/onboard/basic-info` returns nothing; manual checks at lines 47-49.

### REV-06-b: Duplicate `BasicInfoFormData` types with conflicting shapes
- Severity: high
- Category: maintainability
- Location: `packages/shared/src/validation/restaurant.ts:128` vs `apps/web-portal/components/onboarding/types.ts:5-18`
- Observation: Shared exports `BasicInfoFormData = z.infer<typeof basicInfoSchema>` (fields: name, description, address, location, phone, website, cuisines). The local `BasicInfoFormData` interface adds `restaurant_type`, `service_speed`, `payment_methods`, `delivery_available`, `takeout_available`, `dine_in_available`, `accepts_reservations` — which live in `operationsSchema` in shared — and carries `location: LocationData` with different field names (`postalCode`, `neighborhood`).
- Why it matters: Two types with the same name in a project is a trap for maintainers. The onboarding form imports the local one (`@/components/onboarding/types`) while `useRestaurantDraft` imports the local one too but references shared enums; any future refactor that assumes "the shared one is canonical" will silently mismatch. It also explains why REV-06-a can't simply drop in `zodResolver(basicInfoSchema)` — the forms inhabit a superset shape.
- Suggested direction: Either (a) rename the local type to `OnboardingFormData` and define it as `z.infer<typeof basicInfoSchema.merge(operationsSchema)>` with an address translation for the `location` sub-object, or (b) move the combined schema into `packages/shared` and delete the local type. The spelling divergence (`neighborhood` UI ↔ `neighbourhood` DB) should get a single adapter, not be re-done in three files.
- Confidence: confirmed
- Evidence: Grep: `type BasicInfoFormData` → two hits.

### REV-06-c: Admin `RestaurantForm` redefines a third, diverging restaurant schema
- Severity: high
- Category: correctness
- Location: `apps/web-portal/components/admin/RestaurantForm.tsx:38-62`
- Observation: A local `restaurantSchema` is defined inline rather than reusing shared `basicInfoSchema` + `operationsSchema`. Differences:
  - `name: z.string().min(1)` here vs `.min(2)` in shared (line 4).
  - `phone: z.string().optional()` here vs `.regex(/^\+?[1-9]\d{1,14}$/)` in shared (line 18).
  - `website: z.string().optional()` here vs `.url()` in shared (line 22).
  - `locationSchema` lat/lng have no bounds here vs `min(-90)/max(90)` and `min(-180)/max(180)` in shared (lines 13-15).
  - `address: z.string()` here has no min vs `.min(5)` in shared (line 11).
  - `operating_hours` and `cuisines` are omitted from the Zod schema entirely (they live in sibling `useState`, not the form).
- Why it matters: The same entity (a restaurant) is validated differently depending on whether the admin or the owner-onboarding wizard creates/edits it. An admin can save a restaurant that would later fail owner-side validation, and vice versa. Constraint drift between schemas is exactly what Zod was adopted to prevent.
- Suggested direction: Import and compose the shared schemas. If the admin form needs relaxed rules (e.g. allow empty phone for legacy imports), `.optional()` them via a `.partial()` or `.pick()` derivation from the shared base. Do not re-declare field constraints locally.
- Confidence: confirmed
- Evidence: Field-by-field diff above; `grep "import.*basicInfoSchema" apps/web-portal/components/admin/RestaurantForm.tsx` → no results.

### REV-06-d: `formDataToDbColumns` lets NaN/empty lat-lng reach Supabase
- Severity: high
- Category: correctness
- Location: `apps/web-portal/components/admin/RestaurantForm.tsx:192-215` (helper) + `:390-391` (feeder)
- Observation: `onFormSubmit` round-trips the numeric `values.location.lat/lng` through `.toString()` with `values.location.lat ? values.location.lat.toString() : ''`. For a legitimate `lat=0` (equator), this yields `''`. `formDataToDbColumns` then computes `parseFloat('')` → `NaN` and writes `location: { lat: NaN, lng: NaN }` to Supabase. Separately, if `initialData.latitude` is a garbage string like `"N/A"`, initialization at line 343 collapses to `0` via `|| 0`, losing the error.
- Why it matters: JSON serialization of NaN is `null`, so the DB gets `{lat: null, lng: null}` and PostGIS insertion fails — or worse, silently writes zeroed coordinates for a literally-zero latitude. This is the same class of bug called out in CLAUDE.md pitfall #1. Also, no Zod `.refine` guards NaN for the `z.number()` fields.
- Suggested direction: Replace `lat ? lat.toString() : ''` with `Number.isFinite(lat) ? lat.toString() : ''`, and add `.refine(v => Number.isFinite(v), 'required')` on the `locationSchema` lat/lng fields. Or skip the string detour entirely — pass numbers to `formDataToDbColumns`.
- Confidence: confirmed
- Evidence: Lines 192-193, 215, 390-391; `JSON.stringify(NaN) === "null"`.

### REV-06-e: `variants` in the dish form is `as Dish['variants']`-cast despite schema divergence
- Severity: medium
- Category: maintainability
- Location: `apps/web-portal/lib/hooks/useDishFormData.ts:245-248`
- Observation: The Zod variant shape is `{ id?, name, price, description?, serves?, display_price_prefix? }` (`packages/shared/src/validation/restaurant.ts:75-88`) but `Dish.variants` is `Dish[]` (full dish, requires `dietary_tags`, `allergens`, etc. per `types/restaurant.ts:117`). The wizard path builds `localDish` via `variants: (data.variants ?? []) as Dish['variants']` and tacks on `selectedIngredients` with `as Dish & { selectedIngredients?: ... }`.
- Why it matters: The cast hides a real type hole — tests won't catch a required field being dropped if code elsewhere later assumes `dish.variants[i].dietary_tags` exists. Two types shaped "like a dish but simpler" should be modelled explicitly.
- Suggested direction: Introduce a `DishVariantInput` type in `packages/shared/src/types` matching the form's variant shape and reference it from both the schema and `Dish.variants`. Or make `Dish.variants?: DishVariantInput[]` optional-and-distinct from a child `Dish`.
- Confidence: confirmed
- Evidence: `z.object({ id, name, price, description, serves, display_price_prefix })` at restaurant.ts:76-87; `variants?: Dish[]` at types/restaurant.ts:117.

### REV-06-f: `menuSchema` imported but never executed; dishes reach DB unvalidated
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/app/onboard/menu/page.tsx:24`
- Observation: `import { menuSchema } from '@eatme/shared'` — there is no `.parse()` or `.safeParse()` call anywhere in the file. `handleNext` (line 291) only checks `allDishes.length === 0` then hands `menus` straight to `saveMenus(restaurantId, menus)`.
- Why it matters: Dishes migrated from legacy single-menu storage (lines 89-100) or mutated by past code paths can violate `dishSchema` (name length, price bounds) and the corruption propagates to DB. Also, the unused import is a smell — reviewers assume validation exists.
- Suggested direction: Call `menuSchema.safeParse({ dishes: allDishes })` before `saveMenus`; surface errors into toast/per-dish badges. Or remove the import if validation is intentionally deferred to the review step.
- Confidence: confirmed
- Evidence: Single import on line 24, zero usages below it.

### REV-06-g: Option groups bypass the Zod form field entirely
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/components/forms/dish/DishOptionsSection.tsx:20-28, 103-115` + `useDishFormData.ts:99-113, 111`
- Observation: `dishSchema.option_groups` exists (lines 90-117 of restaurant.ts). The UI instead keeps a parallel `optionGroups` React state owned by `useDishFormData` (line 63) and passes it to `DishOptionsSection` via props. On reset the form field is always set to `option_groups: []` (lines 99, 113). On submit, `localDish.option_groups = optionGroups` is merged from the sibling state (useDishFormData.ts:246).
- Why it matters: The `option_groups` schema constraints (min_selections, max_selections nullability, options[].name min(1), etc.) never run. An admin can save an option group with an empty-string name or `min_selections=-1` and Zod does nothing.
- Suggested direction: Drive `optionGroups` through `useFieldArray({ name: 'option_groups' })` so `zodResolver` validates it. Alternatively, call `dishSchema.shape.option_groups.parse(optionGroups)` in `handleFormSubmit` before persisting. The current split-state pattern is a common source of form/schema drift.
- Confidence: confirmed
- Evidence: `option_groups: []` always reset at lines 99 + 113; submit path at line 246.

### REV-06-h: No `min_selections <= max_selections` cross-field validation
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/components/forms/dish/DishOptionsSection.tsx:168-206`
- Observation: `min_selections` and `max_selections` inputs write independent values. Users can set min=5, max=2. The Zod schema has no `.refine(...)` tying them together.
- Why it matters: Silent data corruption. At runtime, the mobile app would hit an impossible constraint (can never satisfy a group with min=5 from max=2 options) and render a broken picker.
- Suggested direction: Add `.superRefine((g, ctx) => { if (g.max_selections != null && g.min_selections > g.max_selections) ctx.addIssue(...); })` to the option-group Zod schema once REV-06-g routes it through Zod.
- Confidence: confirmed
- Evidence: Inputs at lines 174-204; no refine in `restaurant.ts:90-117`.

### REV-06-i: `timeSchema` validates HH:MM format but not open < close
- Severity: medium
- Category: correctness
- Location: `packages/shared/src/validation/restaurant.ts:27-30` + `apps/web-portal/components/forms/OperatingHoursEditor.tsx:32-37`
- Observation: `timeSchema` only regex-matches `HH:MM`. No guard that `close > open`. `OperatingHoursEditor` lets users set `open=21:00, close=09:00` without complaint. Overnight hours (e.g., bars closing 02:00) are also unrepresentable without an explicit next-day flag.
- Why it matters: Corrupt hours silently reach the mobile app's open/closed display logic (CLAUDE.md lists "timezone/currency handling" as a correctness concern). Even if the UI coerces, analytics and sort order depend on raw values.
- Suggested direction: `.superRefine` the day schema, or at minimum warn in the editor when `close <= open`. For overnight, add an `overnight?: boolean` flag or represent it via a time range that crosses midnight.
- Confidence: confirmed
- Evidence: Schema lines 27-30; editor lines 32-37 store values verbatim.

### REV-06-j: Review step surfaces only the first Zod issue
- Severity: medium
- Category: correctness (UX)
- Location: `apps/web-portal/app/onboard/review/page.tsx:64-68`
- Observation: `const validation = basicInfoSchema.safeParse(restaurantData.basicInfo); if (!validation.success) toast.error(validation.error.issues[0]?.message ?? ...)`.
- Why it matters: If three required fields are missing, the user sees one toast, fixes it, resubmits, hits the next error, repeat. For an onboarding wizard this is a noticeable UX hit; worse, the fields that failed may live two steps back so the user loses context.
- Suggested direction: Iterate `validation.error.issues`, route each to the owning step (basic-info vs menu), and surface them inline on the review summary or deep-link the user back to the offending step with `errors` preserved.
- Confidence: confirmed
- Evidence: Line 66 only indexes `[0]`.

### REV-06-k: Documented localStorage key `restaurant-draft` does not match reality
- Severity: medium
- Category: conventions
- Location: `packages/shared/src/types/restaurant.ts:189` (comment) + `apps/web-portal/lib/storage.ts:4` (real key) + `CLAUDE.md` pitfall #3
- Observation: The doc comment says "Persisted to localStorage under 'restaurant-draft'"; CLAUDE.md lists `restaurant-draft` and `onboarding-step` as reserved keys. Real key is `eatme_draft_${userId}`. No `onboarding-step` key exists.
- Why it matters: CLAUDE.md pitfall #3 explicitly warns that changing these keys "breaks in-progress onboarding" — implying the key is load-bearing. But the code has already diverged from the doc, and any future contributor following CLAUDE.md will look for the wrong key and may add a second one. Documentation is a contract; this one is stale.
- Suggested direction: Update CLAUDE.md + the type comment to reflect the real `eatme_draft_${userId}` scheme, or (lower value) rename the key to `restaurant-draft` to match docs. The first option is much cheaper.
- Confidence: confirmed
- Evidence: Direct grep of `eatme_draft` vs `restaurant-draft`.

### REV-06-l: `photo_url` lacks URL validation
- Severity: low
- Category: correctness
- Location: `packages/shared/src/validation/restaurant.ts:62`
- Observation: `photo_url: z.string().optional()` — accepts any string, including non-URLs. `DishPhotoField` placeholder says `https://example.com/photo.jpg`.
- Why it matters: An admin can paste a path fragment or raw text and get through; the mobile app then fails to load the image with no form-time feedback.
- Suggested direction: `photo_url: z.string().url().or(z.literal('')).optional()` or similar — matches the treatment of `website` in `basicInfoSchema:22`.
- Confidence: confirmed
- Evidence: Line 62, identical non-`.url()` pattern for `variants[].description` etc.

### REV-06-m: "Dish Category *" label claims required; schema is `.nullable().optional()`
- Severity: low
- Category: correctness (UX)
- Location: `apps/web-portal/components/forms/dish/DishCategorySelect.tsx:52-58` vs `packages/shared/src/validation/restaurant.ts:51`
- Observation: Label renders `Dish Category *`, implying required. Schema: `dish_category_id: z.string().uuid('Invalid category').nullable().optional()` — no required rule. Form submits with `null` without complaint.
- Why it matters: Users who skip the select never see an error, contradicting the asterisk. Either the asterisk is wrong or the schema is wrong.
- Suggested direction: If the product wants it required, drop `.nullable().optional()` and add a friendly message. If optional is intended, drop the asterisk.
- Confidence: confirmed
- Evidence: Asterisk on line 54, schema line 51.

### REV-06-n: British/American spelling divergence inside one file
- Severity: low
- Category: maintainability
- Location: `apps/web-portal/components/admin/RestaurantForm.tsx:42` (`neighborhood`) vs `:117, :169` (`neighbourhood`)
- Observation: `locationSchema.neighborhood` (American) in the Zod schema, `RestaurantFormData.neighbourhood` (British) in the props interface, `convertDbToFormData` maps DB's `neighbourhood` column. The form has to translate twice on every round-trip.
- Why it matters: Any new field added to the location object can drift in the same way — and a typo in one place would compile if the spellings are interchangeable by string. Not a bug today, but a reliable source of future ones.
- Suggested direction: Pick one spelling (prefer the DB's `neighbourhood`) and make the zod schema + form data types match. Rename `locationSchema.neighborhood` → `neighbourhood`.
- Confidence: confirmed
- Evidence: Lines 42, 117, 169 of the file.

### REV-06-o: `watch as unknown as UseFormWatch<BasicInfoFormData>` double-cast
- Severity: low
- Category: maintainability
- Location: `apps/web-portal/components/admin/RestaurantForm.tsx:359-363`
- Observation: `useRestaurantDraft` is typed for `BasicInfoFormData` (the local onboarding shape). Admin form's values are `RestaurantFormValues` (local schema). The call site forces the conversion via `watch as unknown as UseFormWatch<BasicInfoFormData>` and similar casts on the refs.
- Why it matters: Any field added to the onboarding `BasicInfoFormData` will not produce a type error in the admin form even if the hook relies on it — auto-save can silently break for admin-created drafts.
- Suggested direction: Make `useRestaurantDraft` generic over the form shape, or extract the draft-write logic into a pure function that takes a plain object.
- Confidence: confirmed
- Evidence: Lines 358-363 of the file.

### REV-06-p: `calories` schema + `as number` cast mask NaN handling fragility
- Severity: low
- Category: correctness
- Location: `packages/shared/src/validation/restaurant.ts:58` + `apps/web-portal/lib/hooks/useDishFormData.ts:232, 274`
- Observation: `calories: z.number().min(0).max(5000).optional().or(z.nan())` explicitly accepts NaN (because RHF `valueAsNumber` returns NaN for empty inputs). Callers then use `!isNaN(data.calories as number) && data.calories != null`. The `as number` is a lie: value can be `undefined | number | NaN`.
- Why it matters: Works today, but any refactor that trusts `data.calories` being a number could dereference NaN silently. The pattern is borderline: the schema lets NaN pass *and* callers have to filter it back out.
- Suggested direction: Add a `.transform(v => (typeof v === 'number' && !Number.isNaN(v)) ? v : undefined)` in the schema so consumers get a clean `number | undefined`. Drop the `as number` casts.
- Confidence: confirmed
- Evidence: Line 58 uses `.or(z.nan())`; two cast sites.

### REV-06-q: Price-delta numeric inputs accept NaN without guards
- Severity: low
- Category: correctness
- Location: `apps/web-portal/components/forms/dish/DishOptionsSection.tsx:278-292`
- Observation: `price_delta: Number(e.target.value)`. `Number('')` is `0`; `Number('abc')` is `NaN`. There is no guard before writing back to the options state, and the Zod schema only has `.default(0)` (not a `.refine` against NaN).
- Why it matters: NaN persisted as `null` (JSON) or NaN (JS), and arithmetic on rendered prices goes wrong. Form submits without Zod ever touching this path (see REV-06-g), so nothing catches it.
- Suggested direction: Wrap with `const n = Number(...); if (!Number.isFinite(n)) return;` or render via `register(..., { valueAsNumber: true })` under a proper field-array.
- Confidence: confirmed
- Evidence: Line 286.

### REV-06-r: Test mocks reference non-existent modules
- Severity: low
- Category: dx
- Location: `apps/web-portal/test/BasicInfoPage.test.tsx:31-61`, `test/DishFormDialog.test.tsx:62-65`, plus `test/LocationFormSection.test.tsx`, `test/LocationSection.test.tsx`, `test/step19-onboarding-responsiveness.test.tsx`, `test/useRestaurantDraft.test.ts`
- Observation: Tests `vi.mock('@/lib/constants', ...)` and `vi.mock('@/lib/validation', ...)`. Neither path exists — the real code imports from `@eatme/shared`. `find apps/web-portal/lib -name 'validation*'` returns nothing; `lib/constants.ts` does not exist either.
- Why it matters: The mocks are no-ops. Tests that relied on them to shield from real shared-package state are running against real shared. Usually benign, sometimes flaky. More importantly, reviewers skim-reading the mocks assume isolation that doesn't exist.
- Suggested direction: Either delete the stale mocks, or if isolation is needed, `vi.mock('@eatme/shared', () => (...))` with the same data.
- Confidence: confirmed
- Evidence: File globs; file search confirms absence.

### REV-06-s: Defensive `!user?.id` checks after `ProtectedRoute` already guarantees user
- Severity: info
- Category: maintainability
- Location: `apps/web-portal/app/onboard/basic-info/page.tsx:49, 154-160`; similar in `menu/page.tsx:300`
- Observation: Pages are wrapped in `ProtectedRoute` (lines 154-160) which gates rendering on auth. Handlers then still guard `if (!user?.id) { toast.error('User not authenticated'); return; }`. If `user` could be missing, the form above wouldn't have rendered.
- Why it matters: Minor noise, but repeated enough to mislead a reader into thinking the auth contract is weaker than it is. Hides a potential bug in `ProtectedRoute` if one ever ships.
- Suggested direction: Drop the redundant check, or promote `user.id` to a non-null context value guaranteed by `ProtectedRoute`.
- Confidence: confirmed
- Evidence: `ProtectedRoute` wraps the whole page; then line 49 inside handler.

### REV-06-t: Inconsistent validation pattern within the onboarding wizard
- Severity: info
- Category: conventions
- Location: `apps/web-portal/app/onboard/basic-info/page.tsx` (manual) vs `apps/web-portal/components/forms/DishFormDialog.tsx:50-52` (zodResolver)
- Observation: Within the same onboarding flow, step 1 uses no resolver and hand-rolled validation; step 2 (dish dialog) uses `zodResolver(dishSchema)`. The admin area adds yet a third pattern (local inline schema, REV-06-c).
- Why it matters: Three validation paradigms in one app surface. New contributors will pick whichever convention they saw first and drift further. Also blocks adopting any global form-error-reporter.
- Suggested direction: Adopt `zodResolver` across all forms, with shared schemas. Remove the exceptions.
- Confidence: confirmed
- Evidence: Cross-file comparison above.

### REV-06-u: Duplicated `DEFAULT_HOURS` constants
- Severity: info
- Category: maintainability
- Location: `apps/web-portal/lib/hooks/useRestaurantDraft.ts:16-24` + `apps/web-portal/components/admin/RestaurantForm.tsx:229-237`
- Observation: Two independent copies of the default weekly operating hours. Drift is still small (both identical today) but any edit has to be mirrored.
- Suggested direction: Export a `DEFAULT_OPERATING_HOURS` constant from `@eatme/shared` (next to `DAYS_OF_WEEK`) and import from both sites.
- Confidence: confirmed
- Evidence: Byte-equal constants in the two files.

### REV-06-v: `loadFormDefaults` is a deep manual nullish-coalescing tree
- Severity: info
- Category: maintainability
- Location: `apps/web-portal/lib/hooks/useRestaurantDraft.ts:189-241`
- Observation: Every field is read with `savedData.basicInfo?.x || default`, including the `LocationData` sub-object. Adding a new form field means touching both the interface and this function, and omissions fail silently (missing key → form default is also missing → uncontrolled input warnings).
- Suggested direction: Derive defaults from a single source (e.g. `BasicInfoFormData.parse({})` with a default-producing schema) instead of manual spread. Or at least list keys once and map.
- Confidence: likely
- Evidence: Lines 189-241; the function is 53 lines of defaults.

## No issues found in

- `packages/shared/src/validation/restaurant.ts:76-88` (variant sub-schema) — shapes match the form's `useFieldArray` usage.
- `DishBasicFields` field registration — `valueAsNumber` + schema `.min(0).max(10000)` cleanly catches empty/absurd prices.
- `DishDietarySection` — tag toggling preserves the array invariant (vegan implies vegetarian) at lines 18-30; no Zod hole observable.
- `DishKindSelector`, `DishVisibilityFields`, `DishSpiceLevel` — radio groups correctly bound to schema enums.
- `OperatingHoursEditor` quick-fill — handles the weekday/weekend presets idempotently.
- `import-validation.ts` — schema-side validation is tight (lat/lng bounds, cuisine filter on unknown values); the `MX` fallback is intentional per comment.
- Storage module's JSON parse error handling — `try/catch` at each entry point, no throw-across-boundary.

## Follow-up questions

1. Is the onboarding wizard's lack of Zod intentional (e.g., draft-first, validate-on-submit in `review/page.tsx`), or an oversight? If intentional, consider documenting the contract in CLAUDE.md so reviewers stop flagging it.
2. Was `restaurant-draft` (per CLAUDE.md) ever the storage key, or has it always been `eatme_draft_${userId}`? If the former, are there still production users with drafts under the old key that need migration?
3. Should `variants[].dietary_tags` / `allergens` be inherited from the parent dish or required per variant? That answers whether `DishVariantInput` (REV-06-e) should carry them.
4. `payment_methods` shared schema exposes only `cash_only | card_only | cash_and_card`; does business need require a fourth value (e.g., `digital_only`) that's currently being written in via the DB but can't be edited in the form?
5. For option groups, who is the source of truth — the form's `option_groups` array (currently dead, REV-06-g) or the `optionGroups` parallel state? Consolidating requires a product decision on whether option groups are versioned per dish or cross-dish.
