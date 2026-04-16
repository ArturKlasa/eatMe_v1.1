# REV-12: Tokens consumption + web-portal a11y

## Scope reviewed

Token sources & generation:
- `packages/tokens/src/colors.ts` (1–123)
- `packages/tokens/src/index.ts` (1–50)
- `packages/tokens/scripts/generate-css-vars.ts` (1–119)
- `apps/web-portal/app/tokens.css` (generated; full file 1–105)
- `apps/web-portal/app/globals.css` (1–229)

Web consumers — UI primitives:
- `apps/web-portal/components/ui/{button,input,label,checkbox,select,dialog,form,badge,pagination}.tsx` (full)

Web consumers — feature components:
- `apps/web-portal/components/OnboardingStepper.tsx` (1–91)
- `apps/web-portal/components/admin/AdminSidebar.tsx` (1–80)
- `apps/web-portal/components/admin/RestaurantWarningBadge.tsx` (1–31)
- `apps/web-portal/components/admin/ImportAreaSelector.tsx` (1–311)
- `apps/web-portal/components/admin/menu-scan/DishGroupCard.tsx` (1–243)
- `apps/web-portal/components/admin/menu-scan/FlaggedDuplicateCard.tsx` (1–60)
- `apps/web-portal/components/admin/menu-scan/BatchToolbar.tsx` (1–80)
- `apps/web-portal/components/forms/DishCard.tsx` (1–162)
- `apps/web-portal/components/forms/CuisineSelector.tsx` (1–140)
- `apps/web-portal/components/onboarding/BasicInfoFields.tsx` (1–95)
- `apps/web-portal/components/IngredientAutocomplete.tsx` (1–223)
- `apps/web-portal/components/LocationPicker.tsx` (1–192)
- `apps/web-portal/components/ConfirmDialog.tsx` (1–66)
- `apps/web-portal/lib/ui-constants.ts` (1–81)
- `apps/web-portal/app/global-error.tsx` (1–94)
- `apps/web-portal/app/admin/menu-scan/components/MenuExtractionList.tsx` (1–80)

Test coverage:
- `apps/web-portal/test/no-hardcoded-colors.test.ts` (1–79)

Spot-checks for hard-coded color usage repo-wide:
- `Grep '#[0-9a-fA-F]{3,8}' apps/web-portal **/*.{ts,tsx,css}` → 4 matches
- `Grep '@eatme/tokens'` in `apps/web-portal/**` → 1 match (`package.json` only — no source import)
- `Grep '--token-color|--token-space|--token-radius|--token-shadow'` in `apps/web-portal/**` → only the generated `tokens.css` itself + tests + 3 typography-size lines in `globals.css`
- `Grep` for `bg-(amber|yellow|purple|orange|green|red|blue|gray)-N` etc. across `apps/web-portal` → 22 files

## Findings

### REV-12-a: design-token system is orphaned in the web portal
- Severity: high
- Category: maintainability
- Location: `apps/web-portal/app/globals.css:62-150`, `apps/web-portal/app/tokens.css:1-105`
- Observation: `tokens.css` is generated from `@eatme/tokens` and exposes ~80 `--token-color-*`, `--token-space-*`, `--token-radius-*`, and `--token-shadow-*` variables. The shadcn theme palette in `globals.css` (`--brand-primary`, `--brand-accent`, `--primary`, `--secondary`, `--background`, `--success`, `--warning`, `--info`, `--destructive`, `--card`, `--ring`, `--chart-*`, `--sidebar-*`, etc.) is defined inline at `:root` and `.dark` blocks **without referencing any `--token-color-*` value**. Only three lines of `globals.css` consume tokens: `font-size: var(--token-type-size-3xl|2xl|xl)` for `h1/h2/h3` (`globals.css:159-171`). Spacing/radius/shadow tokens have **zero** consumers in app source. Across `apps/web-portal/**` source files, `@eatme/tokens` is imported nowhere — only declared in `apps/web-portal/package.json:16`.
- Why it matters: The "single source of truth" framing in `agent_docs/architecture.md` and the agenda for this review is not enforced. Brand colors live in two parallel definitions (e.g. `colors.primary = '#FF6B35'` in `packages/tokens/src/colors.ts:17` vs. `--brand-primary: oklch(0.651 0.201 38.2)` in `globals.css:71`) and can drift silently — a token edit only affects the mobile app and the typography sizes on web. Any future redesign that touches `@eatme/tokens` will not propagate to the web UI.
- Suggested direction: rewrite `globals.css :root`/`.dark` blocks to alias each shadcn variable from a `--token-color-*` value (e.g. `--brand-primary: var(--token-color-primary)`); add a unit test that asserts every `--brand-*`/`--primary`/`--accent` definition resolves through a token; consider auto-generating the shadcn alias map from the tokens package.
- Confidence: confirmed
- Evidence:
  - `globals.css:71`: `--brand-primary: oklch(0.651 0.201 38.2); /* #FF6B35 */`
  - `tokens.css:3`: `--token-color-primary: oklch(0.7045... 39.23);` — different oklch value
  - `Grep '@eatme/tokens' apps/web-portal/**` returns only `package.json:16`
  - `Grep '--token-(color|space|radius|shadow)' apps/web-portal/**` returns only `tokens.css`, the test, and the 3 typography rules in `globals.css`

### REV-12-b: hard-coded Tailwind color guard misses .ts files and most palette names
- Severity: high
- Category: dx
- Location: `apps/web-portal/test/no-hardcoded-colors.test.ts:11-22, 33`
- Observation: The CI guard scans only files ending in `.tsx` (line 33: `entry.endsWith('.tsx')`). The `BANNED_PATTERNS` list (lines 11–22) bans only `text-/bg-` for `gray|orange|green|red|blue` — it omits `border-*`, `bg-/text-amber`, `bg-/text-yellow`, `bg-/text-purple`, `bg-/text-cyan`, `bg-/text-pink`, `bg-/text-stone`, `bg-/text-fuchsia`, `bg-/text-violet`, `bg-/text-rose`, `bg-/text-sky`, `bg-/text-teal`, `bg-/text-lime`, etc., and arbitrary-value classes like `bg-[#…]`. Every violation in REV-12-d below is currently passing.
- Why it matters: The test file's name and intent suggest enforcement, but the actual coverage is narrow enough that the codebase can drift back into hard-coded colors freely (and clearly has). Reviewers and PR authors will trust a green test that doesn't catch the very thing it advertises.
- Suggested direction: extend `getAllTsxFiles` to include `.ts`, expand `BANNED_PATTERNS` to cover all Tailwind palette names + `border-*-N` + arbitrary-value forms (`/\b(text|bg|border)-\[#/`), and split `lib/ui-constants.ts` and any other "color-config" files into a documented allowlist if categorical badges legitimately need palette colors.
- Confidence: confirmed
- Evidence:
  - line 33: `} else if (entry.endsWith('.tsx')) {`
  - lines 11–22: BANNED_PATTERNS array shown above

### REV-12-c: nut_seed badge background uses non-existent Tailwind class `bg-brown-100`
- Severity: medium
- Category: correctness
- Location: `apps/web-portal/lib/ui-constants.ts:31`
- Observation: `nut_seed: { bg: 'bg-brown-100', text: 'text-yellow-900' }` — Tailwind's default palette has no `brown` family (only `stone`, `amber`, `orange`, `yellow`, etc.). The class is emitted to the DOM but produces no CSS rule, leaving the badge background transparent / inheriting the parent surface while siblings get a colored chip.
- Why it matters: Visible regression for ingredients tagged `nut_seed` (almonds, peanuts, etc.) — a high-allergy-risk category. The tag stops being scannable at a glance and inconsistent with the rest of the family palette.
- Suggested direction: pick a real palette (`bg-stone-200` matches the `stone` row used for `grain`, or define a custom `brown` color in `tailwind.config`). Add a unit test that resolves each `INGREDIENT_FAMILY_COLORS[*].bg` against a known palette list.
- Confidence: confirmed
- Evidence: line 31: `nut_seed: { bg: 'bg-brown-100', text: 'text-yellow-900' },` — `Grep 'brown' tailwind.config*` (none found in repo) confirms no custom brown defined.

### REV-12-d: widespread hard-coded palette classes for status/info chrome bypass tokens
- Severity: medium
- Category: maintainability
- Location: multiple
- Observation: Status/severity surfaces use literal Tailwind palette classes rather than the semantic `surface-warning|info|success|error` utilities defined in `globals.css:196-201` or shadcn theme variables:
  - `apps/web-portal/components/admin/menu-scan/DishGroupCard.tsx:42` — `'bg-yellow-100 text-yellow-700'` for medium-confidence badge
  - `DishGroupCard.tsx:47-50` — `'border-green-300 bg-success/10'` / `'border-red-300 bg-destructive/10'` / `'border-blue-200 bg-info/10'` for group status
  - `DishGroupCard.tsx:69` — `'bg-purple-100 text-purple-700'` for dish-kind chip
  - `DishGroupCard.tsx:144` — `'border-blue-200'` connector line
  - `apps/web-portal/components/admin/menu-scan/FlaggedDuplicateCard.tsx:19,22,25,30,41,50` — full `amber-50/300/400/500/600/700/800` palette for the duplicate-warning card
  - `apps/web-portal/components/admin/AdminSidebar.tsx:34-35` — `'bg-yellow-50 border-yellow-200 text-yellow-800'` and `'text-yellow-600'` for the security notice
  - `apps/web-portal/components/admin/RestaurantWarningBadge.tsx:24` — `'bg-amber-50 text-amber-700'`
  - `apps/web-portal/components/forms/DishCard.tsx:51` — `'border-purple-300 text-purple-700 bg-purple-50'` for dish-kind badge (different shade than DishGroupCard for the same concept)
  - `apps/web-portal/components/onboarding/BasicInfoFields.tsx:49` — `errors.name ? 'border-red-500' : ''` (also: no `aria-invalid` — see REV-12-h)
  - `apps/web-portal/components/admin/AddIngredientPanel.tsx:338` — `'border-orange-200'`
  - `apps/web-portal/components/admin/InlineIngredientSearch.tsx:87` — `'border-orange-300 ... ring-orange-400'`
  - `apps/web-portal/components/admin/ImportAreaSelector.tsx:271` — `'accent-orange-500'`; line 295 — `'border-orange-200'`
  - `apps/web-portal/lib/ui-constants.ts:19-70` — entire `INGREDIENT_FAMILY_COLORS`, `DIETARY_TAG_COLORS`, `STATUS_VARIANTS` maps in raw palette classes
- Why it matters: Same semantic concept (warning, duplicate, info, success) is encoded with several different shades and palettes across the admin surface. Re-theming for dark mode, brand refresh, or contrast fixes cannot be done at one place. The duplication also masks subtle bugs — e.g. the `dish_kind` badge is purple-100/700 in one place and purple-300/700 in another for the same data.
- Suggested direction: route status surfaces through `surface-warning|info|success|error` utilities (already defined in `globals.css:196-201`) and the existing `bg-success/10 text-success` pattern (used elsewhere in the same files); centralize `INGREDIENT_FAMILY_COLORS` against tokens or extract to a typed semantic-color contract that the lint guard understands.
- Confidence: confirmed
- Evidence: file:line citations above all read directly from source.

### REV-12-e: hard-coded hex colors in JS-style attributes bypass both tokens and the lint guard
- Severity: medium
- Category: maintainability
- Location: `apps/web-portal/app/global-error.tsx:30-88`, `apps/web-portal/components/admin/ImportAreaSelector.tsx:144-145`
- Observation:
  - `global-error.tsx` is a Client Component that intentionally bypasses the root layout per Next.js docs (file-level comment lines 5–11). Every visual value is a literal hex inside `style={{ … }}`: `backgroundColor: '#fafafa'`, `color: '#111'`, `'#666'`, `'#999'`, `backgroundColor: '#ea580c'`, `color: '#fff'`. None reference CSS vars or tokens.
  - `ImportAreaSelector.tsx:144-145` passes hard-coded `#f97316` to Leaflet's `L.circle(..., { color, fillColor })` for the map selection circle — Leaflet does not consume CSS vars at runtime, so the circle color cannot follow the brand if it changes.
- Why it matters: `global-error` is the page users see when something is on fire — it should still look like EatMe, including dark-mode awareness. The Leaflet circle is the primary visual cue for the import-area selector and currently locks orange-500 in instead of `colors.primary` (`#FF6B35`).
- Suggested direction: in `global-error.tsx`, import a tiny inline `<style>` that defines vars from `@eatme/tokens` JS values (Server Component would be ideal but `'use client'` is required by Next.js). For Leaflet, read the resolved value of `--brand-primary` via `getComputedStyle(document.documentElement)` at mount, or pass `colors.primary` from `@eatme/tokens` directly.
- Confidence: confirmed
- Evidence: `global-error.tsx:36,53,62,69,78-79`; `ImportAreaSelector.tsx:144-145`

### REV-12-f: LocationPicker has no keyboard alternative for setting coordinates
- Severity: medium
- Category: a11y
- Location: `apps/web-portal/components/LocationPicker.tsx:96-153, 182-188`
- Observation: The map is the sole means of selecting a restaurant's location during onboarding. Coordinates are set only via `map.on('click', …)` (line 96). The map container has `aria-label="Restaurant location map"` (line 184) but is a non-focusable `<div>` with no `tabIndex`, no keyboard handlers, and no fallback inputs for lat/lng. There is no autocomplete address search either (compare with `ImportAreaSelector.tsx:152-208`, which at least has a city search box).
- Why it matters: Keyboard-only and screen-reader users cannot complete the onboarding step. Per WCAG 2.1.1 (Keyboard) all functionality must be operable through a keyboard interface. This blocks a significant portion of restaurant owners from finishing setup.
- Suggested direction: add an address autocomplete (Nominatim forward-geocode like ImportAreaSelector does) plus optional manual lat/lng inputs; or wrap the map in a focusable region with arrow-key panning + Enter to select centre. Either fallback unblocks keyboard users without removing the map UX.
- Confidence: confirmed
- Evidence: `LocationPicker.tsx:96` map click handler is the only setter; `LocationPicker.tsx:182-188` map div has no `tabIndex`/`onKeyDown`.

### REV-12-g: DishGroupCard uses raw `<select>` / `<input>` elements without labels
- Severity: medium
- Category: a11y
- Location: `apps/web-portal/components/admin/menu-scan/DishGroupCard.tsx:58-63, 84-98, 161-170, 173-188, 211-237`
- Observation: The dish-group review card relies on raw HTML form controls instead of the shadcn Select / Checkbox / Input primitives:
  - Line 58–63: `<input type="checkbox">` for "select group" — no `<label>`, no `aria-label`. Screen-reader output is just "checkbox, not checked".
  - Line 84–98 and 173–188: `<select>` for `dish_kind` and `display_price_prefix` — only `title` attribute (line 169 has `title="Serves"`, others have nothing) — no associated `<label htmlFor>`, no `aria-label`. Each dish row exposes 3–4 unlabelled selects.
  - Line 161–170: `<input type="number">` for `serves` — `title="Serves"` only.
  - Line 211–237: parent-level controls do use `<label>` wrapping, which is correct — but the per-child row controls don't.
- Why it matters: WCAG 1.3.1 / 4.1.2 — form controls must have programmatically determinable names. `title` attributes are not announced reliably (some screen readers ignore them, mobile browsers don't expose them at all). The component is the primary admin tool for the AI menu-scan review flow.
- Suggested direction: wrap each control in a `<label className="sr-only">` or add `aria-label`; better, swap to the shadcn `Select` / `Checkbox` primitives that already manage `aria-*` plumbing.
- Confidence: confirmed
- Evidence: file:line citations above read directly from source.

### REV-12-h: BasicInfoFields renders error border without aria-invalid or rendered error text
- Severity: medium
- Category: a11y
- Location: `apps/web-portal/components/onboarding/BasicInfoFields.tsx:42-50`
- Observation: The `Restaurant Name` `<Input>` only changes its border to red (`'border-red-500'`) when `errors.name` is set; it does not pass `aria-invalid={!!errors.name}` and there is no `<p>` rendering the error message. The shadcn `Input` primitive supports `aria-invalid` styling natively (`apps/web-portal/components/ui/input.tsx:13`), and the field is not wrapped in `FormField`/`FormMessage` from `apps/web-portal/components/ui/form.tsx` which would handle this automatically.
- Why it matters: Screen-reader users get no indication of validation failure, and the visual-only red border fails WCAG 1.4.1 (Use of Color). Onboarding is a high-stakes flow.
- Suggested direction: convert this and any sibling onboarding fields to the `FormField` + `FormControl` + `FormMessage` pattern (already in use in `apps/web-portal/components/ui/form.tsx`) or at minimum pass `aria-invalid={!!errors.name}` and render `errors.name?.message` in a `<p id={...}>` referenced by `aria-describedby`.
- Confidence: confirmed
- Evidence: `BasicInfoFields.tsx:45-50` shows the bare `Input` + className-only error.

### REV-12-i: IngredientAutocomplete announces combobox role but has no keyboard navigation
- Severity: medium
- Category: a11y
- Location: `apps/web-portal/components/IngredientAutocomplete.tsx:96-167`
- Observation: The input declares `role="combobox" aria-expanded={isOpen} aria-controls="ingredient-suggestions"` (lines 109–111) and the dropdown declares `role="listbox"` with each item `role="option"` (lines 134, 141). However there is no `onKeyDown` handler on the input and no `aria-activedescendant` is set. Arrow Up/Down do not move highlight, Enter does not select, Escape does not close — only mouse clicks work.
- Why it matters: WAI-ARIA combobox pattern explicitly requires keyboard semantics. Declaring the roles without the behaviour is worse than not declaring them — assistive tech announces "combobox, expanded" then the user finds nothing happens when they press arrow keys. WCAG 2.1.1 / 4.1.2 violations.
- Suggested direction: add an arrow-key handler that maintains `activeIndex`, set `aria-activedescendant={\`ingredient-option-${activeIndex}\`}`, give each `<button role="option">` an id, handle Enter/Escape, and either drop the ARIA roles or also add ARIA support. Consider replacing with Radix's `Combobox` (or `cmdk`) which handles all of this.
- Confidence: confirmed
- Evidence: `IngredientAutocomplete.tsx:96-167` — search for `onKeyDown` returns nothing in the file.

### REV-12-j: RestaurantWarningBadge uses `title` for warning detail text
- Severity: low
- Category: a11y
- Location: `apps/web-portal/components/admin/RestaurantWarningBadge.tsx:21-29`
- Observation: The badge is rendered as `<span title={warnings.map(...).join('\n')}>` showing only an `AlertTriangle` icon and a count. The full warning list is exposed only via the `title` attribute.
- Why it matters: `title` tooltips are not focusable, not announced reliably by screen readers, and don't appear on touch devices — so the warning details are invisible to a large portion of users. Only the count is conveyed.
- Suggested direction: convert to a button with a Radix Tooltip / Popover, or expose the warnings as an `aria-label` describing them in full ("3 warnings: Missing cuisine types, Missing opening hours, …"). Same pattern likely repeats for the `title="Edit (E)"` shortcut hints in `DishGroupCard.tsx:106,116,126` — fine because each button also has `aria-label`, but worth grepping.
- Confidence: confirmed
- Evidence: `RestaurantWarningBadge.tsx:23` — only `title` carries the detail.

### REV-12-k: dialog focus styles use generic gray ring instead of brand
- Severity: low
- Category: a11y
- Location: `apps/web-portal/app/globals.css:99, 133`
- Observation: `--ring: oklch(0.708 0 0)` (light) and `--ring: oklch(0.556 0 0)` (dark) are pure neutrals. shadcn primitives (`button.tsx:8`, `input.tsx:12`, `select.tsx:40`, `checkbox.tsx:17`, `dialog.tsx:72`) all bind focus visibility to `ring-ring/50`, which means focused controls show a 50%-alpha gray halo. Against the white background that's roughly 3:1 — meets WCAG 1.4.11 minimum but is borderline and unaligned with brand orange.
- Why it matters: Focus indicators are mandatory under WCAG 2.4.7. A near-invisible focus ring on a busy admin form (e.g. `DishGroupCard`) is the most common keyboard-user complaint for admin SaaS tools.
- Suggested direction: alias `--ring` to `--brand-primary` (or `--brand-accent`) in light theme; verify contrast against `--background` via the CSS color contrast spec (`color(from var(--ring) ...)`). Easiest patch: `--ring: var(--brand-primary)` plus `ring-ring/40` on shadcn primitives.
- Confidence: likely
- Evidence: `globals.css:99,133` for the values; ring usage at `button.tsx:8`, `input.tsx:12`, `dialog.tsx:72`, etc.

### REV-12-l: button `xs` and `icon-xs` sizes are 24px squares — meets WCAG 2.1 AA but borderline
- Severity: low
- Category: a11y
- Location: `apps/web-portal/components/ui/button.tsx:25, 29`
- Observation: `xs: "h-6 gap-1 rounded-md px-2 …"` and `"icon-xs": "size-6 …"` produce 24×24 buttons. They appear in the menu-scan review surface (`DishGroupCard.tsx:101-138` uses `size="sm"` h-7, but neighbours use the `icon-xs` 24px form for inline removes — see `DishGroupCard.tsx:194` `h-6 w-6 p-0`).
- Why it matters: WCAG 2.5.8 (Target Size — Minimum, 2.2 AA) requires 24×24 with adjacent-target spacing. The 24×24 buttons in DishGroupCard sit directly next to other 24×24 buttons with no spacer — an apparent violation. Less of an issue on the desktop admin tool but still a concern for small-trackpad users.
- Suggested direction: bump `icon-xs` rows in DishGroupCard to `h-7` / `size-7` (28px) or add `gap-2` spacing between adjacent inline action buttons; document the 24px target spacing requirement so reviewers don't shrink in future.
- Confidence: likely
- Evidence: `button.tsx:25,29` plus `DishGroupCard.tsx:194-200` (`Unlink` row).

### REV-12-m: amber/yellow text-on-light-bg combinations need contrast verification
- Severity: low
- Category: a11y
- Location: `apps/web-portal/components/admin/menu-scan/FlaggedDuplicateCard.tsx:25,30`, `apps/web-portal/components/admin/RestaurantWarningBadge.tsx:24`
- Observation: `text-amber-600` on `bg-amber-50/30` (FlaggedDuplicateCard:25) and `text-amber-500` on `bg-amber-50/30` (line 30) are warm yellow text on a near-white surface. Tailwind v4 default `amber-500` is roughly oklch(0.769 0.188 70), `amber-600` is roughly oklch(0.666 0.179 58). On `amber-50/30` (≈white-tinted-amber) this is in the 3.0–3.5:1 range for normal text — fails WCAG 1.4.3 AA (4.5:1). `amber-700` and `amber-800` are fine.
- Why it matters: The card is a warning surface — users may not be able to read the explanatory text ("Same name … different prices"). The category line at line 30 is the worst offender.
- Suggested direction: bump text to `text-amber-700` / `text-amber-800` or consume the `surface-warning` utility (`globals.css:199`) which uses `--warning` foreground correctly. Run an automated contrast check (axe-core, pa11y) over the menu-scan review screen.
- Confidence: needs-verification (computed contrast estimate; should be verified with an actual axe run against rendered DOM, which this read-only review cannot do)
- Evidence: `FlaggedDuplicateCard.tsx:19,25,30`

### REV-12-n: gray500 / textTertiary tokens fail WCAG AA against white
- Severity: low
- Category: a11y
- Location: `packages/tokens/src/colors.ts:37, 46`
- Observation: `gray500: '#ADB5BD'` against `background: '#FFFFFF'` ≈ 2.42:1 (fails AA 4.5:1, fails AA Large 3:1). `textTertiary: '#999999'` against white ≈ 2.85:1 (fails AA, fails AA Large). These tokens are publicly exported and may be used as text color (mobile already uses them in `apps/mobile/src/styles/restaurantDetail.ts:350` `'#888888'` — comparable problem).
- Why it matters: Any consumer that picks `colors.textTertiary` for body or even disabled text on a white surface produces unreadable text for low-vision users. Disabled UI is at least signalled by other affordances; but tertiary text is a pattern that gets copied into non-disabled use.
- Suggested direction: rename `textTertiary` to `textDisabled` to discourage non-disabled use, OR shift its value to ≥ `#767676` to meet 4.5:1 against white. Add a contrast lint to the tokens package that asserts every text-purpose token meets AA against the matching surface token.
- Confidence: confirmed (contrast values are deterministic from the hex)
- Evidence: `colors.ts:37,46` and contrast computation: relative luminance of `#ADB5BD` is 0.4498, vs white 1.0 → (1.0 + 0.05) / (0.4498 + 0.05) = 2.42. For `#999999`, L = 0.318 → 2.85.

### REV-12-o: i18n hooks do not feed into the web portal
- Severity: info
- Category: a11y
- Location: `apps/web-portal/components/onboarding/BasicInfoFields.tsx:36-67`, all admin pages
- Observation: All web-portal copy is hard-coded English in JSX (`"Restaurant Name"`, `"Tell customers about your restaurant…"`, `"Onboarding progress"`, etc.). There is no i18n provider, no locale switcher, and no `lang` attribute on form descriptions. Mobile has `en/es/pl` (per REV-11) but the owner-facing portal is English-only.
- Why it matters: A11y tool announcement uses the document `lang`. Spanish-speaking restaurant owners cannot self-onboard. Not a defect against current spec (the project may intentionally serve English-first) but worth confirming alignment with REV-11.
- Suggested direction: confirm intent with the team; if multilingual web portal is a roadmap item, plumb i18next now while the surface is small.
- Confidence: needs-verification (product intent question)
- Evidence: Read of all named files above; no `useTranslation`/`i18n.t`/`react-i18next` import in `apps/web-portal/components/**/*.tsx` (Grep confirmed).

## No issues found in

- Generated `tokens.css` itself — values match `colors.ts` modulo expected hex→oklch conversion (spot-checked `--token-color-warning` against `#FF9800` per `generate-css-vars.test.ts:36-43`).
- `packages/tokens/src/spacing.ts`, `borderRadius.ts`, `typography.ts`, `shadows.ts`, `layout.ts` — token shape is sensible; not consumed in web-portal beyond typography sizes (which is an REV-12-a problem, not a primitive problem).
- shadcn primitives' ARIA wiring at `Form` / `FormField` / `FormControl` (`apps/web-portal/components/ui/form.tsx:107-156`) — this layer is correct; the issue is that consumers (e.g. `BasicInfoFields`) don't use it.
- Pagination primitive (`apps/web-portal/components/ui/pagination.tsx:1-128`) — correct `aria-current`, `aria-label`, `<nav role="navigation">`.
- Dialog primitive Close button has `<span className="sr-only">Close</span>` (line 75) — correct.
- `Label` primitive correctly uses `LabelPrimitive.Root` (Radix), inheriting htmlFor wiring.
- Brand-primary buttons (`button.tsx:12 bg-primary text-primary-foreground`) — colors are tokens (shadcn palette), so the per-component rendering is fine; the underlying token-source disconnect is REV-12-a.
- Mobile token consumption (`apps/mobile/src/styles/theme.ts:14-32` re-exports cleanly from `@eatme/tokens`; 284 imports across 10 files via `Grep`). Mobile is the correct consumer model — web is the outlier.

## Follow-up questions

1. Was the disconnect between `--token-color-*` and `--brand-*` / shadcn variables intentional during the redesign (e.g. shadcn shipped first, tokens added later)? The planning doc `.agents/planning/2026-04-10-web-portal-redesign/research/tokens-integration.md` may contain the rationale — should we adopt or reverse it? (Read-only constraint kept this review out of planning docs beyond filename indexing.)
2. For REV-12-d / REV-12-c: the categorical INGREDIENT_FAMILY_COLORS map uses palette diversity intentionally to make 20 categories visually distinct — is the requirement "distinct hue per family" or "themed surface" tokens? The fix differs.
3. For REV-12-f (LocationPicker keyboard): is there an existing accessibility budget / WCAG conformance target for the owner portal? Without that we don't know which medium-severity a11y items must ship vs. backlog.
4. For REV-12-l (target size): some tools ship `xs` only because admin density demands it. Confirm whether DishGroupCard's adjacency violates 2.5.8 spacing exception (which allows <24px if surrounded by ≥24px clear space) by inspecting rendered spacing in the live UI.
5. For REV-12-o: should the web portal also get `i18next` for parity with mobile, or is the owner audience English-only by design?
