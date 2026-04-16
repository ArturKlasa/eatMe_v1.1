# Mobile i18n (en/es/pl)

## Scope reviewed

- `apps/mobile/src/i18n/index.ts` (full, 117 lines)
- `apps/mobile/src/locales/en.json`, `es.json`, `pl.json` (full — 1069 lines each, 952 leaf keys)
- `apps/mobile/src/components/LanguageSelector.tsx` (1-60)
- `apps/mobile/src/components/FloatingMenu.tsx` (25-76)
- `apps/mobile/src/screens/BasicMapScreen.tsx` (135-230, 540-560)
- `apps/mobile/src/screens/ProfileScreen.tsx` (110-125)
- `apps/mobile/src/screens/auth/RegisterScreen.tsx` (88-105)
- `apps/mobile/src/components/rating/RateDishScreen.tsx` (175-210)
- Spot-check via Explore subagent across all `apps/mobile/src/screens/` and `apps/mobile/src/components/` for hard-coded strings and dynamic `t()` keys

### Cross-locale parity script
Ran a node script that flattens all three locale files and compares key sets, placeholder sets (`{{var}}`), and identical EN==translation strings. Output captured — 0 missing keys, 0 extra keys, 0 placeholder mismatches.

## Findings

### REV-11-a: FloatingMenu hard-codes 4 navigation labels in English
- Severity: medium
- Category: maintainability
- Location: `apps/mobile/src/components/FloatingMenu.tsx:33-38`
- Observation: The `menuItems` array literally embeds English labels:
  ```ts
  { id: 'filters', label: 'Personal filters', icon: '🥢', screen: 'Filters' },
  { id: 'profile', label: 'Profile', icon: '👤', screen: 'Profile' },
  { id: 'eatTogether', label: 'Eat together', icon: '🍲', screen: 'EatTogether' },
  { id: 'settings', label: 'Settings', icon: '⚙️', screen: 'Settings' },
  ```
  These are then rendered raw at line 69: `<Text style={floatingMenuStyles.menuLabel}>{item.label}</Text>`. The component does not import `useTranslation`.
- Why it matters: The floating menu is a primary navigation surface. Polish and Spanish users see English labels for Profile/Settings/etc., breaking the locale contract for the entire app's main entry points. Equivalent strings already exist in locales (e.g. `settings.title`, `profile.title`, `filters.title` per spot-check of locale files).
- Suggested direction: Replace `label: 'Profile'` with a `labelKey: 'menu.profile'`, call `useTranslation()` inside the component, and render `t(item.labelKey)`. Add the four keys to all three locale files.
- Confidence: confirmed
- Evidence: Direct read of `FloatingMenu.tsx:33-69` shown above; no `useTranslation` import in the file.

### REV-11-b: BasicMapScreen loading overlay strings are hard-coded English
- Severity: medium
- Category: maintainability
- Location: `apps/mobile/src/screens/BasicMapScreen.tsx:548-553`
- Observation:
  ```tsx
  <Text style={...}>
    {geoLoading ? 'Finding nearby restaurants...' : 'Loading restaurants...'}
  </Text>
  {userLocation && (
    <Text style={...}>
      Searching within 5km radius
    </Text>
  )}
  ```
  Three user-visible strings rendered raw, while the rest of the file uses `t()`.
- Why it matters: First-launch experience in Spanish/Polish flashes English while restaurants load — a high-visibility surface (every map session goes through this loading state).
- Suggested direction: Add `map.findingNearby`, `map.loadingRestaurants`, `map.searchRadius` keys (the radius value `5km` could be interpolated to support unit conversion later).
- Confidence: confirmed
- Evidence: Lines quoted above from direct read.

### REV-11-c: LanguageSelector concatenates translations with English grammar
- Severity: medium
- Category: correctness
- Location: `apps/mobile/src/components/LanguageSelector.tsx:35-37`
- Observation:
  ```tsx
  <Text style={styles.subtitle}>
    {t('common.select')} {t('settings.language').toLowerCase()}
  </Text>
  ```
  This concatenates "Select" + " " + "language" assuming English word order and that lower-casing the first letter is grammatical.
- Why it matters: In Polish and Spanish this produces wrong grammar (e.g. PL would naturally be "Wybierz język", but a verb + lower-cased noun-from-another-key concatenation is fragile for any inflected language). Capitalisation rules also vary (German nouns capitalize regardless of position).
- Suggested direction: Add a single dedicated key `settings.selectLanguagePrompt` translated holistically per locale, replacing the concatenation.
- Confidence: confirmed
- Evidence: Direct read of `LanguageSelector.tsx:34-37`; reflects a well-known i18n anti-pattern.

### REV-11-d: i18n initializes synchronously with English then async-loads stored language
- Severity: low
- Category: correctness
- Location: `apps/mobile/src/i18n/index.ts:48-88`
- Observation: `i18n.use(initReactI18next).init({ ..., lng: 'en', ... })` runs synchronously at module import (line 48-60), with `react: { useSuspense: false }`. Then `loadSavedLanguage()` (line 67-85) awaits zustand persist rehydration and then calls `i18n.changeLanguage(language)` if it differs. There is no Suspense boundary or splash gate — components render against `'en'` for the first frames.
- Why it matters: Users with Spanish/Polish preference see a brief flash of English text on cold launch every session. With `useSuspense: false`, no component blocks on rehydration; observable as label flicker (esp. on slower devices).
- Suggested direction: Either (a) gate the navigation root on a `i18nReady` boolean updated when `loadSavedLanguage` resolves; or (b) make the initial `lng` come from a synchronously readable source (e.g. `RNLocalize.getLocales()` resolved before init) rather than always 'en'. The async store read can still override after, but the wrong-language window shrinks dramatically.
- Confidence: confirmed
- Evidence: Direct read of `i18n/index.ts:48-88`; comment at line 22 acknowledges the rehydration race ("a language selected on the login screen is not silently overwritten").

### REV-11-e: ProfileScreen builds an English allergy sentence regardless of locale
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/screens/ProfileScreen.tsx:112-117`
- Observation:
  ```ts
  const activeAllergies = Object.entries(permanent.allergies)
    .filter(([_, active]) => active)
    .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1));
  if (activeAllergies.length > 0) {
    summary.push(`Allergic to ${activeAllergies.join(', ')}`);
  }
  ```
  The phrase "Allergic to" and the capitalisation logic are English-only. The allergy names are also taken from the data key directly (e.g. `gluten`, `dairy`) rather than translated.
- Why it matters: Users in PL/ES see "Allergic to Gluten, Dairy" embedded in their profile summary. Allergy info is medically important UI.
- Suggested direction: Use an interpolation key like `profile.allergicTo` (`"Allergic to {{list}}"` translated per locale) and resolve allergy names through `t(\`filters.allergy.${name}\`)` (those keys already exist — confirmed via locale parity script).
- Confidence: confirmed
- Evidence: Direct read of `ProfileScreen.tsx:112-117`; locale files have `filters.allergy.gluten`, `filters.allergy.dairy`, etc.

### REV-11-f: RegisterScreen Alert mixes `t()` and hard-coded "Error"
- Severity: low
- Category: conventions
- Location: `apps/mobile/src/screens/auth/RegisterScreen.tsx:96`
- Observation: Lines 90 and 101 in the same file use `Alert.alert(t('auth.error'), ...)`, but line 96 uses the literal `Alert.alert('Error', passwordError)`.
- Why it matters: Inconsistent — Spanish/Polish users see "Error" (which happens to be valid in ES/PL too, so user-visible impact is small) instead of the localized title. The bigger risk is `passwordError` itself — a quick check of `validatePassword` would tell whether that string is also hard-coded English.
- Suggested direction: Replace with `Alert.alert(t('auth.error'), passwordError)`. Audit `validatePassword` for hard-coded English error messages.
- Confidence: confirmed
- Evidence: Direct read of `RegisterScreen.tsx:88-102`.

### REV-11-g: Empty Polish translations for `time.am` / `time.pm`
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/locales/pl.json` (`time.am = ""`, `time.pm = ""`)
- Observation: Cross-locale parity script flagged two empty values in `pl.json`. EN/ES both have `"AM"` / `"PM"`. A grep across `apps/mobile/src/` for `time.am`/`time.pm` returns no consumers today (no matches), so this is latent.
- Why it matters: If any future code references these keys, Polish users get an empty string instead of a fallback to English (i18next does not auto-fallback per-key when the key resolves to a present-but-empty string in the active language; the empty value short-circuits fallback in default config).
- Suggested direction: Either delete the unused `time.am`/`time.pm` keys from all three locales, or fill in the PL values (Polish uses 24h time idiomatically — a reasonable PL value would still be `"AM"`/`"PM"` if the keys are kept for consistency, or `"przed południem"`/`"po południu"` if expanded).
- Confidence: confirmed
- Evidence: Parity script output: `Empty PL values: 2 — time.am, time.pm`. Grep for `time\.(am|pm)` across `apps/mobile`: no matches.

### REV-11-h: `auth.email` and `settings.build` appear untranslated in Polish
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/locales/pl.json` — `auth.email = "Email"`, `settings.build = "Build"`
- Observation: Parity script flagged these as identical across EN and PL. Most identical strings are loanword cuisine/dish names ("Pizza", "Sushi", "Tacos") which is correct, but `auth.email` and `settings.build` look like missed translations — Polish would idiomatically use "E-mail" / "Adres e-mail" for the form label and "Wersja" or "Numer kompilacji" for build.
- Why it matters: Minor polish gap; users can still understand "Email" but the build label mixed with otherwise-translated settings reads as an unfinished translation.
- Suggested direction: Confirm with native PL speaker; if untranslated, set `auth.email` → "E-mail" / "Adres e-mail" and `settings.build` → "Wersja" or similar. (`settings.email` is also identical at `"Email"` — same call.)
- Confidence: needs-verification
- Evidence: Parity script output listing 78 ES==EN and ~80 PL==EN identical leaf strings, of which most are loanwords; the two flagged here stand out as form-label text.

### REV-11-i: BasicMapScreen "Unknown" fallbacks are English literals
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/screens/BasicMapScreen.tsx:141, 170, 226, 229`
- Observation: Four `|| 'Unknown'` / `|| 'Unknown Restaurant'` fallbacks for cuisine and restaurant name when data is missing. These literals are then surfaced into the `MapRestaurant`/`MapDish` shapes and rendered to users.
- Why it matters: When the edge function returns rows missing `cuisine_types` or `restaurant.name`, PL/ES users see English placeholders. Less common path but visible in the wild whenever data hygiene slips on the server side.
- Suggested direction: Either render `t('common.unknown')`/`t('common.unknownRestaurant')` (add keys), or push the fallback to render time so the t() can be applied at the consumer.
- Confidence: confirmed
- Evidence: Direct read of `BasicMapScreen.tsx:141, 170, 226, 229`.

### REV-11-j: `defaultValue` in `t()` calls masks key drift
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/components/rating/RateDishScreen.tsx:181, 190-192, 199-202`
- Observation: Three `t(key, { defaultValue: '<English>' })` calls. The keys (`rating.rateDish.addNote`, `rating.rateDish.noteCharLimit`) currently exist in all three locale files, so the defaultValue is dead code today. But this pattern lets future contributors add new `defaultValue` calls that silently work in EN while quietly missing from ES/PL — extractors and runtime do not warn when defaultValue is provided.
- Why it matters: Latent regression vector; not currently broken but undermines the "missing-key fallback chain" the rest of the app relies on.
- Suggested direction: Drop the `defaultValue` argument; rely on i18next's `fallbackLng: 'en'` (already configured at `i18n/index.ts:51`) for missing-key cases. Add a lint rule banning `defaultValue` if available.
- Confidence: confirmed
- Evidence: Direct read of `RateDishScreen.tsx:175-210`; verified key presence with parity script (all three keys exist in en/es/pl).

### REV-11-k: i18n device-locale resolver has dead conditional branches
- Severity: info
- Category: maintainability
- Location: `apps/mobile/src/i18n/index.ts:28-37`
- Observation:
  ```ts
  if (languageCode === 'es') return 'es';
  if (languageCode === 'pl') return 'pl';
  if (languageCode === 'en') return 'en';
  // Check for country-specific variants
  if (primaryLocale.countryCode?.toLowerCase() === 'mx' && languageCode === 'es') return 'es';
  if (primaryLocale.countryCode?.toLowerCase() === 'pl') return 'pl';
  ```
  The two "country-specific" branches are unreachable: a locale with `languageCode === 'es'` already returned at line 30; `countryCode === 'pl'` users typically also have `languageCode === 'pl'` and returned at line 31. (The `countryCode === 'pl'` test does NOT also check the language code, so theoretically a Polish-resident with English language settings would land here — but that returns `'pl'`, which the user explicitly did not select.)
- Why it matters: Dead branches hide intent. The country-only branch (line 36) could even be wrong behavior if a Polish-resident user has English as their device language.
- Suggested direction: Delete the unreachable lines. If country-aware fallback is desired, design it explicitly (e.g., only override when language is not in the supported set).
- Confidence: confirmed
- Evidence: Direct read of `i18n/index.ts:23-39`.

## No issues found in

- Locale key parity: 952 leaf keys present identically in en/es/pl; 0 missing, 0 extra (verified via flattening script).
- Interpolation placeholder parity: every `{{var}}` placeholder in EN appears with the same name in ES and PL (script-verified, 0 mismatches).
- Empty values in ES locale: 0.
- `LoginScreen.tsx`, `FavoritesScreen.tsx`, `SettingsScreen.tsx`, `ProfileEditScreen.tsx`, `EatTogetherScreen.tsx`, `ViewedHistoryScreen.tsx` — Explore-subagent spot-check found these consistently use `t()` for user-visible strings.
- `OnboardingStep1Screen.tsx` — dynamic `t(\`onboarding.${diet.key}\`)` keys verified safe because the `diet.key` set comes from a fixed constant array (subagent spot-check).
- i18next `escapeValue: false` (line 56) — correct because React already escapes; not an XSS hole.

## Follow-up questions

1. Are `auth.email`, `settings.email`, `settings.build` (PL) intentionally kept as English loanwords (brand decision) or untranslated by oversight? Native PL reviewer needed.
2. Are `time.am`/`time.pm` keys reserved for a planned 12h-time UI, or vestigial? If unused, remove from all three locales.
3. Does `validatePassword` (referenced from `RegisterScreen.tsx:94`) return a translated or hard-coded English string? If hard-coded, REV-11-f should be promoted to medium.
4. Is there a CI check for locale-key parity across en/es/pl? If not, REV-11 issues will recur as new strings are added.
5. Is the language-flash race (REV-11-d) acceptable product-side, or is there an existing splash screen that hides cold-start?
