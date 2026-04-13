# Prompt Engineering — AI Call Site Analysis

## Current state

Four OpenAI call sites exist in the monorepo. Each uses different prompt patterns, response format enforcement, and parameter tuning.

### 1. GPT-4o Vision extraction (`route.ts:83-148`, `route.ts:165-230`)

- **Model**: `gpt-4o` (`route.ts:170`)
- **Response format**: `zodResponseFormat(MenuExtractionSchema, 'menu_extraction')` — true Structured Outputs with schema enforcement (`route.ts:188`)
- **Temperature**: 0.1 (`route.ts:190`)
- **max_tokens**: 16384 (`route.ts:189`)
- **Truncation handling**: Detects `finish_reason === 'length'` and injects extraction note for admin review (`route.ts:195-218`)
- **System prompt**: 148 lines, well-structured with numbered rules, dish pattern decision tree, parent-child rules, 3 few-shot examples, quality self-report instructions (`route.ts:83-148`)
- **Assessment**: Best-engineered prompt in the codebase. Structured Outputs guarantees schema conformance. Few-shot examples cover key patterns. Self-report extraction notes are a good innovation.

### 2. Ingredient suggestion (`suggest-ingredients/route.ts:85-106`)

- **Model**: `gpt-4o-mini` (`route.ts:86`)
- **Response format**: `{ type: 'json_object' }` — NOT Structured Outputs (`route.ts:104`). No schema enforcement; the model can return any valid JSON.
- **Temperature**: **not set** — defaults to 1.0 (`route.ts:85-106`, no `temperature` parameter)
- **max_tokens**: 500 (`route.ts:105`)
- **System prompt**: Inline string concatenation, lists valid codes as raw text in the prompt (`route.ts:90-97`). No few-shot examples.
- **Parsing**: Manual JSON.parse + runtime filtering against `VALID_DIETARY_TAGS` / `VALID_ALLERGENS` sets (`route.ts:108-152`). Silently drops invalid codes rather than re-prompting.
- **Assessment**: Most fragile prompt. Temperature 1.0 means non-deterministic ingredient lists across identical inputs. No schema enforcement means the model could return `{"ingredients": "chicken"}` (string not array) and only runtime filtering catches it. No few-shot examples for ambiguous dishes.

### 3. Ingredient translation (`route.ts:351-389`)

- **Model**: `gpt-4o-mini` (`route.ts:357`)
- **Response format**: `{ type: 'json_object' }` — NOT Structured Outputs (`route.ts:371`)
- **Temperature**: **not set** — defaults to 1.0 (`route.ts:357-372`, no `temperature` parameter)
- **max_tokens**: 512 (`route.ts:372`)
- **System prompt**: 3 lines — "You are a culinary ingredient translator…" (`route.ts:361-366`). No few-shot examples. Mentions "primarily Spanish" despite the codebase supporting 18+ country codes via `COUNTRY_LANGUAGE_MAP` (`route.ts:255-274`).
- **Parsing**: Handles both `{translations: {...}}` and flat `{...}` shapes (`route.ts:378-381`). No retry on failure; catches all errors and returns `{}` (`route.ts:386-389`).
- **Assessment**: The "primarily Spanish" hint biases translations toward Spanish interpretations even for Polish/French/Italian menus. No few-shot examples for multilingual edge cases (e.g., "pierogi" should not be translated, "pollo" should).

### 4. Background enrichment (`enrich-dish/index.ts:101-167`)

- **Model**: `gpt-4o-mini` (`enrich-dish/index.ts:28`, `enrich-dish/index.ts:133`)
- **Response format**: `{ type: 'json_object' }` — NOT Structured Outputs (`enrich-dish/index.ts:139`)
- **Temperature**: 0.2 (`enrich-dish/index.ts:141`)
- **max_tokens**: 256 (`enrich-dish/index.ts:140`) — very tight for 8 ingredients + dish type + notes + allergens + category
- **System prompt**: 12 lines (`enrich-dish/index.ts:105-122`). Includes the response schema as prose. No few-shot examples. 
- **Uses raw `fetch`** instead of OpenAI SDK (`enrich-dish/index.ts:127-143`) — no SDK-level retries, no Structured Outputs support, manual error handling.
- **Parsing**: Trusts `JSON.parse(content)` with spread operator (`enrich-dish/index.ts:155-162`). Any unexpected keys from the model are silently included in the enrichment payload stored to DB.
- **Assessment**: The 256 max_tokens budget risks truncation on dishes with long descriptions or many inferred ingredients. Raw fetch means no SDK retry logic. Spread operator means hallucinated keys pollute the DB payload.

## Reliability / accuracy gaps

### Gap 1: Allergen vocabulary mismatch between endpoints

- `suggest-ingredients/route.ts:45-60` uses: `milk, eggs, fish, shellfish, tree_nuts, peanuts, wheat, soybeans, sesame, gluten, lactose, sulfites, mustard, celery` (14 codes)
- `enrich-dish/index.ts:109` prompt uses: `dairy, eggs, fish, shellfish, tree_nuts, peanuts, wheat, soy, sesame` (9 codes)
- **Conflicts**: "dairy" vs "milk", "soy" vs "soybeans"
- **Missing in enrich-dish**: gluten, lactose, sulfites, mustard, celery
- **Impact**: A dish processed through both paths gets inconsistent allergen codes. Downstream consumers querying `WHERE 'milk' = ANY(allergens)` will miss enrich-dish results that used "dairy".

### Gap 2: Temperature 1.0 on classification prompts

- `suggest-ingredients` and `translateIngredients` both default to temperature 1.0
- For "Pad Thai", repeated calls could return `["rice noodles", "shrimp", "peanuts", "bean sprouts", "egg"]` one time and `["flat noodles", "prawns", "groundnuts", "sprouts", "lime"]` next
- This causes non-deterministic ingredient matching, dietary tag inference, and allergen detection across identical dishes scanned at different times

### Gap 3: No Structured Outputs on 3 of 4 endpoints

- Only `route.ts` (vision extraction) uses `zodResponseFormat`
- The other three use `json_object` mode which guarantees valid JSON but not schema conformance
- `suggest-ingredients` could return `{"ingredients": "chicken"}` (string, not array)
- `enrich-dish` could return extra keys that get spread into the DB payload
- `translateIngredients` relies on an ambiguous "return a JSON object mapping each original name to its standard English culinary name" — the model sometimes wraps in `{"translations": {...}}` and the code has a workaround (`route.ts:378-381`)

### Gap 4: No few-shot examples on suggestion/enrichment prompts

- The vision extraction prompt has 3 carefully crafted examples (`route.ts:121-134`)
- `suggest-ingredients`, `translateIngredients`, and `enrich-dish` have zero examples
- Few-shot examples would reduce hallucination and improve consistency, especially for:
  - Ambiguous dishes ("Spring Rolls" — Vietnamese vs Chinese, very different ingredients)
  - Edge cases in translation ("pierogi" should stay as "pierogi", not "dumpling")
  - Dish category assignment ("Açaí Bowl" → "Bowl" not "Dessert")

### Gap 5: Translation prompt language bias

- `route.ts:363`: "which may be in any language, primarily Spanish"
- The codebase supports 18 countries (`COUNTRY_LANGUAGE_MAP`, `route.ts:255-274`) including Polish, French, German, Italian, Portuguese, Japanese, Chinese
- The "primarily Spanish" hint biases GPT-4o-mini toward Spanish interpretations even for non-Spanish terms
- Example: Polish "kaczka" (duck) could be misinterpreted if the model is primed for Spanish

## Improvement opportunities

### PE-01: Add Structured Outputs to suggest-ingredients endpoint

| Field | Value |
|-------|-------|
| **Title** | Replace `json_object` with `zodResponseFormat` in suggest-ingredients |
| **Current behaviour** | `suggest-ingredients/route.ts:104` uses `{ type: 'json_object' }` — no schema enforcement. Runtime filtering (`route.ts:114-136`) catches type errors but silently drops data. |
| **Proposed change** | Define a Zod schema matching the `DishAnalysis` interface (`route.ts:62-68`). Use `zodResponseFormat` as in the main extraction endpoint. Remove or simplify the manual parsing/filtering logic. This guarantees arrays are arrays, codes are from the enum, and spice_level is 0/1/3/null. |
| **Impact** | **H** — eliminates silent data loss from malformed responses; enables removal of ~40 lines of defensive parsing |
| **Effort** | **XS** — Zod schema + one-line change to `response_format`; OpenAI SDK already imported |
| **Dependencies** | None |

### PE-02: Set temperature 0.1–0.2 on all classification/extraction prompts

| Field | Value |
|-------|-------|
| **Title** | Add `temperature: 0.1` to suggest-ingredients and translateIngredients calls |
| **Current behaviour** | `suggest-ingredients/route.ts:85-106` and `route.ts:357-372` omit temperature, defaulting to 1.0. |
| **Proposed change** | Add `temperature: 0.1` to both calls. All four AI endpoints should use 0.1–0.2 for deterministic, reproducible results on classification tasks. |
| **Impact** | **M** — makes ingredient/allergen/dietary inference deterministic across repeated scans of the same dish |
| **Effort** | **XS** — one line per call site |
| **Dependencies** | None |

### PE-03: Unify allergen vocabulary across all endpoints

| Field | Value |
|-------|-------|
| **Title** | Create shared `VALID_ALLERGENS` constant and use it in all prompts + validation |
| **Current behaviour** | `suggest-ingredients/route.ts:45-60` defines 14 allergen codes. `enrich-dish/index.ts:109` hardcodes 9 different codes in the prompt text ("dairy" vs "milk", "soy" vs "soybeans"). No shared constant. |
| **Proposed change** | 1) Move `VALID_ALLERGENS` to `@eatme/shared` (or `lib/menu-scan.ts`). 2) Use the canonical codes in all prompts. 3) Add a normalization step in enrich-dish parsing that maps "dairy"→"milk", "soy"→"soybeans" for backwards compatibility. 4) Include the 5 missing EU allergens (gluten, lactose, sulfites, mustard, celery) in the enrich-dish prompt. |
| **Impact** | **H** — fixes data inconsistency that breaks allergen-based filtering/search |
| **Effort** | **S** — shared constant + prompt update + normalization map |
| **Dependencies** | None (backwards-compatible) |

### PE-04: Add few-shot examples to suggest-ingredients prompt

| Field | Value |
|-------|-------|
| **Title** | Add 3-4 few-shot examples covering ambiguous, multilingual, and edge-case dishes |
| **Current behaviour** | `suggest-ingredients/route.ts:89-97` has zero few-shot examples. The model relies entirely on its training data for ingredient inference. |
| **Proposed change** | Add few-shot examples as `assistant` messages in the conversation: 1) Standard dish: "Margherita Pizza" → specific ingredient list showing format expectations, 2) Ambiguous dish: "Spring Rolls" → show how to handle regional variants (default to most common), 3) Spicy dish: "Pad Kra Pao" → demonstrate spice_level=3 and Thai ingredient names in English, 4) Dietary edge case: "Beyond Burger" → vegan patty but may have dairy bun, show conservative allergen inference. |
| **Impact** | **M** — reduces hallucination on ambiguous dishes; establishes consistent ingredient granularity |
| **Effort** | **XS** — add 4 message pairs to the existing prompt array |
| **Dependencies** | None |

### PE-05: Remove "primarily Spanish" bias from translation prompt

| Field | Value |
|-------|-------|
| **Title** | Make translation prompt language-agnostic with explicit source language parameter |
| **Current behaviour** | `route.ts:363` says "which may be in any language, primarily Spanish". The codebase supports 18 countries via `COUNTRY_LANGUAGE_MAP` (`route.ts:255-274`). `menuLanguage` is already computed (`route.ts:606`) and passed to `matchIngredients` (`route.ts:503`). |
| **Proposed change** | 1) Pass `menuLanguage` to `translateIngredients`. 2) Update the system prompt: "Given a JSON array of food ingredient names in {language}, return a JSON object mapping each to its standard English culinary name. If a name is already a well-known culinary term in English (e.g. 'pierogi', 'tofu', 'naan'), keep it unchanged." 3) Add the language to the user message: `{language: "pl", terms: [...]}`. |
| **Impact** | **M** — eliminates Spanish-biased translations for Polish, French, Italian, and other supported languages |
| **Effort** | **XS** — modify function signature + prompt text |
| **Dependencies** | None — `menuLanguage` already available at the call site |

### PE-06: Migrate enrich-dish from raw fetch to OpenAI SDK

| Field | Value |
|-------|-------|
| **Title** | Replace raw `fetch` calls in enrich-dish with OpenAI SDK (or at minimum, add Structured Outputs) |
| **Current behaviour** | `enrich-dish/index.ts:127-143` uses raw `fetch` to call OpenAI. No SDK retries, no Structured Outputs, manual error handling. The spread operator at `enrich-dish/index.ts:157-162` passes all parsed keys (including hallucinated ones) into the payload. |
| **Proposed change** | Option A (preferred): Import OpenAI SDK in the Deno edge function (available via `npm:openai`). Use `zodResponseFormat` for the enrichment call. Option B (minimal): Keep raw fetch but define a strict schema validation step (Zod parse) before spreading into the payload. Either way, whitelist the output keys to prevent hallucinated fields from reaching the DB. |
| **Impact** | **M** — prevents DB pollution from hallucinated keys; enables SDK retry logic; aligns with rest of codebase |
| **Effort** | **S** — SDK import + Zod schema + replace fetch call |
| **Dependencies** | Verify Deno edge function supports `npm:openai` (it does as of Deno 1.28+) |

### PE-07: Increase max_tokens for enrich-dish from 256 to 512

| Field | Value |
|-------|-------|
| **Title** | Raise enrich-dish max_tokens to prevent truncation on complex dishes |
| **Current behaviour** | `enrich-dish/index.ts:140` sets `max_tokens: 256`. A response with 8 ingredients + dish type + notes + 5 allergens + category easily reaches 200+ tokens. No truncation detection. |
| **Proposed change** | Increase to 512. Add `finish_reason === 'length'` check to detect truncation and log a warning (mirroring the pattern in `route.ts:195`). |
| **Impact** | **L** — prevents silent data loss on complex dishes; marginal cost increase (~$0.001 per enrichment) |
| **Effort** | **XS** — one constant change + 3-line truncation check |
| **Dependencies** | None |

### PE-08: Add extraction context to multi-page prompts

| Field | Value |
|-------|-------|
| **Title** | Include page number and total page count in the user message for multi-page scans |
| **Current behaviour** | `route.ts:181-183` sends identical user message "Extract all dishes from this menu image" for every page. `route.ts:118` tells the model "This menu may be extracted across multiple pages" but provides no page context. Each GPT-4o call is independent — the model cannot know if it's page 1 of 1 or page 3 of 8. |
| **Proposed change** | Change user message to: `"Extract all dishes from this menu image (page {n} of {total})."` This helps the model: 1) be more careful about consistent category naming, 2) recognize when a dish description might be split across pages (flagging via extraction_notes), 3) differentiate front/back of a single-sheet menu. |
| **Impact** | **L** — marginal improvement in category consistency and edge-case flagging |
| **Effort** | **XS** — template string change in the user message |
| **Dependencies** | None |

## Cross-refs

- **Prior baseline**: No prompt engineering items in the baseline; this is entirely new analysis.
- **Depends on TOPIC-04 (dietary-allergen-crossval)**: PE-03 (unified allergen vocab) is a prerequisite for cross-validation logic.
- **Enables TOPIC-02 (data-reliability)**: PE-01 (Structured Outputs) and PE-06 (SDK migration) reduce error surface area analyzed in data-reliability.
- **Enables TOPIC-03 (ingredient-matching)**: PE-05 (language-aware translation) directly improves matching accuracy for non-Spanish menus.
