# Menu Scan AI — Feature Design Document

**Feature:** AI-powered menu image → structured dish data extraction  
**Admin panel location:** `/admin/menu-scan`  
**Status:** Design / pre-implementation  
**Last updated:** 2026-03-01

---

## 1. Problem Statement

Manually adding restaurant dishes to the database is slow and labour-intensive. A single restaurant menu can contain 40–100+ dishes, each requiring a name, price, description, category, and potentially ingredients. This feature lets an admin upload a photo of a physical menu (or multiple photos of a multi-page menu) and have AI extract and pre-populate the structured data, which the admin then reviews and confirms with minimal editing.

---

## 2. Scope & Constraints

| Parameter       | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Expected volume | ~1,000 restaurants / month, avg 2 images each = ~2,000 images/month                                  |
| Image source    | Phone camera photos — often slightly angled, occasional glare                                        |
| Menu languages  | Spanish (primary), English; other languages planned later                                            |
| Who uses it     | Admin only (single user for now)                                                                     |
| Use case        | New restaurants only — no existing menus to merge, but one restaurant's menu may span multiple pages |
| Currency        | **Always inferred from `restaurants.country_code`** — never extracted from image                     |

---

## 3. Recommended Architecture

### Decision: Single-Stage GPT-4o Vision (Option B)

**Recommendation: GPT-4o Vision directly, no separate OCR step.**

#### Why not two-stage (OCR → LLM)?

A two-stage pipeline (e.g. Google Cloud Vision → GPT-4o text) was considered but rejected for this use case:

| Factor                       | Two-Stage (Vision OCR + LLM text)                                                        | Single-Stage (GPT-4o Vision)                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Architecture complexity      | Higher — two APIs, two failure modes, OCR pre-processing step                            | Lower — one API call per image                                              |
| Phone photo quality handling | OCR engines output messy text on angled/glare photos; LLM then works from degraded input | GPT-4o Vision reasons visually, handles partial occlusion and layout better |
| Multi-column menu layout     | OCR often mangles column order; LLM has to untangle text                                 | GPT-4o sees the image and understands layout directly                       |
| Spanish language             | OCR is language-agnostic (good); LLM needs multilingual training                         | GPT-4o is natively multilingual, excellent Spanish                          |
| Cost @ 2,000 images/month    | Google Vision $3 + GPT-4o text $45 ≈ **~$48/month**                                      | GPT-4o Vision ≈ **~$42/month**                                              |
| API accounts needed          | Google Cloud + OpenAI                                                                    | OpenAI only                                                                 |
| Debugging                    | OCR text saved as intermediate artifact (useful)                                         | One fewer artifact; image is already saved for review                       |

The small cost saving is a bonus but the main reason is **quality on real-world phone photos**. GPT-4o Vision's visual reasoning outperforms OCR-then-text on imperfect inputs because it can use context to fill in partially obscured characters, understand visual groupings (columns, section headers, price alignment), and reason about the overall layout simultaneously.

#### Cost Comparison at Scale

| Approach                                         | Monthly cost (2,000 images) | Quality rating |
| ------------------------------------------------ | --------------------------- | -------------- |
| **GPT-4o Vision (recommended)**                  | **~$42**                    | ⭐⭐⭐⭐⭐     |
| Google Vision OCR + GPT-4o text                  | ~$48                        | ⭐⭐⭐⭐⭐     |
| Google Vision OCR + Gemini 2.0 Flash             | ~$5                         | ⭐⭐⭐⭐       |
| GPT-4o Vision + fallback Gemini Flash (low-conf) | ~$30–35                     | ⭐⭐⭐⭐⭐     |
| Claude 3.5 Sonnet Vision                         | ~$60                        | ⭐⭐⭐⭐⭐     |

**Cost derivation for GPT-4o Vision:**  
A phone menu photo resized to ~1080×1920 = 12 tiles at high detail = 85 + (12 × 170) = **2,125 image tokens**.  
Plus system prompt ~400 tokens, output JSON ~1,500 tokens (for ~25 dishes).  
Per image: (2,525 × $2.50 + 1,500 × $10) / 1,000,000 = **~$0.021**.  
For 2,000 images: **~$42/month**.

**Budget escape hatch:** If $42/month becomes a concern, switching Stage 2 to **Gemini 2.0 Flash** (keep GPT-4o Vision as Stage 1 for layout, pass text to Gemini for structuring) drops cost to ~$5/month with acceptable quality. This can be toggled via an environment variable without UI changes.

---

## 4. Data We Need vs. What Menus Provide

Based on the database schema, here is a realistic extraction frequency for phone-photographed menus:

| Database field                       | Table              | Expected frequency on menu | Source                                    |
| ------------------------------------ | ------------------ | -------------------------- | ----------------------------------------- |
| `name`                               | `dishes`           | ✅ 100%                    | Always on menu                            |
| `price`                              | `dishes`           | ✅ ~95%                    | Almost always present                     |
| Menu section name → `menus.name`     | `menus`            | ⚠️ ~70%                    | Section headers ("Lunch", "Dinner")       |
| Category name → `menu_categories`    | `menu_categories`  | ⚠️ ~80%                    | Sub-headers ("Appetizers", "Pasta")       |
| `description`                        | `dishes`           | ⚠️ ~40%                    | Only some restaurants include it          |
| `menu_type` (food/drink)             | `menus`            | ✅ ~90%                    | Inferrable from section context           |
| `dish_category_id`                   | `dishes`           | ❌ 0%                      | Never on menu — LLM infers from name      |
| Dietary symbols → `dietary_tags`     | `dishes`           | ⚠️ ~30%                    | V/VG/GF icons if present                  |
| Ingredient list → `dish_ingredients` | `dish_ingredients` | ❌ ~5%                     | Rare; only high-end menus                 |
| `calories`                           | `dishes`           | ❌ ~5%                     | US chain restaurants only                 |
| `spice_level`                        | `dishes`           | ❌ ~10%                    | Only when explicitly marked               |
| `allergens`                          | `dishes`           | ❌ ~5%                     | Rare; derives from ingredients anyway     |
| `primary_currency`                   | `restaurants`      | N/A                        | **Taken from `restaurants.country_code`** |

**Key principle:** The LLM must never hallucinate. Any field not clearly present in the image must be `null`, not guessed. The admin review step catches all gaps. The goal is to reduce typing, not to auto-fill incorrectly.

---

## 5. Currency Handling

Currency is **not extracted from the menu image**. Instead:

1. When the admin opens the scan page for a specific restaurant, the system reads `restaurants.primary_currency` from the database.
2. All extracted prices are tagged with that currency automatically.
3. If `primary_currency` is not set for the restaurant (edge case), the system falls back to:
   - `country_code` → standard mapping (`MX` → MXN, `US` → USD, `PL` → PLN, etc.)
   - If `country_code` is also missing → default to USD and flag a warning in the UI.

This avoids ambiguity when a menu shows `$` (could be USD or MXN) or doesn't show a symbol at all.

---

## 6. Image Storage Decision

**No Supabase Storage upload required for the main workflow.**

The image stays in browser memory (as a `Blob URL` / `FileReader` result) throughout the session:

- The browser holds the image for the side-by-side review UI.
- The base64-encoded image bytes are sent directly to the GPT-4o Vision API from the Next.js API route (or from a Supabase Edge Function — see Section 9).
- Only the **extracted JSON result** is persisted in the database (`menu_scan_jobs.result_json`).

**Consequence:** If the admin closes the browser tab mid-review, the image is gone. To resume, they re-upload. For an admin-only tool processing ~2 menus/day, this is acceptable. The structured data is already saved in `menu_scan_jobs`, so only the image is lost — not the work done by AI.

**Optional later upgrade:** Add a "Save image for audit trail" toggle that uploads to a `menu-scans/{restaurant_id}/{job_id}.jpg` Supabase Storage path. Storage cost for 2,000 images × 3MB avg = 6GB/month ≈ $0.13 Supabase storage + $0.54 bandwidth — negligible if desired.

---

## 7. Multi-Page Menu Handling

A single restaurant's menu may span multiple pages (photos). The flow supports this:

1. Admin uploads **one or more images** for the same restaurant in one job.
2. All images are processed **in parallel** by GPT-4o Vision (one API call per image).
3. Each image returns a partial JSON structure (menus → categories → dishes).
4. The server **merges** the results client-side by matching on `menu.name` (case-insensitive):
   - If two images both contain "Lunch" → merge their categories/dishes under one `Lunch` menu node.
   - If a category name repeats within the same menu → merge the dish lists.
   - Duplicates detected by exact `dish.name` match → keep first occurrence, flag duplicate for admin.
5. The admin reviews the merged result as a single unified view.

---

## 8. Ingredient Matching & Inline Addition

When the rare case of ingredients being present on the menu occurs, the system:

1. **Tries fuzzy matching** against `ingredients_master` using:
   - Exact name match (case-insensitive)
   - Alias match via `ingredients_master.name_variants[]`
   - If none found → ingredient marked as **"unmatched"**

2. **Unmatched ingredients UI** in the review page:
   - Shown with a yellow ⚠️ badge and a `+ Add to DB` button next to the ingredient name.
   - Clicking opens a **slide-over panel** with a mini-form:
     ```
     Name: [pre-filled with extracted text]
     Category: [dropdown: vegetable/fruit/protein/grain/dairy/spice/herb/condiment/oil/sweetener/beverage/other]
     Vegetarian: [toggle]
     Vegan:      [toggle]
     Allergens:  [multi-select: milk, eggs, fish, shellfish, tree_nuts, peanuts, wheat, soy, sesame]
     Aliases:    [text input, comma separated]
     ```
   - On save → `INSERT INTO ingredients_master` + link `ingredient_allergens` / `ingredient_dietary_tags` records.
   - The ingredient immediately becomes available in the review UI and the dish's ingredient list is updated.
   - **This does not require leaving the review page or losing scan progress.**

3. Once all ingredients are matched (or added), the DB trigger `calculate_dish_allergens()` will auto-populate `dishes.allergens` and `dishes.dietary_tags` on final save (existing behaviour).

---

## 9. Architecture: Supabase Edge Function vs. Next.js API Route

**Recommendation: Next.js API Route** for now, with a clear path to migrate to a Supabase Edge Function.

|                    | Next.js API Route                                      | Supabase Edge Function                                       |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------ |
| Development speed  | Faster — same repo, hot reload, easy debugging         | Slower — requires `supabase functions serve` or deploy cycle |
| Secrets management | `.env.local` (OPENAI_API_KEY)                          | Supabase Vault / `supabase secrets set`                      |
| Timeout            | Vercel: 60s default, configurable up to 300s           | 150s (Deno runtime)                                          |
| Cost               | Included in Vercel hosting                             | Charged per invocation beyond free tier                      |
| Proximity to DB    | No difference — both call Supabase over HTTPS          | Minor latency advantage for post-processing DB writes        |
| Auth check         | Easy via existing `supabase.auth.getSession()` pattern | Requires JWT verification in function                        |

At 2,000 invocations/month the Supabase Edge Function free tier (500K invocations) is fine, but the Next.js route is simpler to develop and debug today. **Migrate to Edge Function later if the app moves to a serverless/edge deployment model.**

---

## 10. Complete Data Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                  ADMIN: /admin/menu-scan                         │
│                                                                  │
│  1. Select restaurant (search / dropdown)                        │
│     → system loads restaurant.primary_currency & country_code    │
│  2. Upload 1–N menu images (drag-and-drop or file picker)        │
│     → images previewed in browser (Blob URLs)                    │
│  3. Click "Extract with AI"                                      │
└─────────────────────────┬────────────────────────────────────────┘
                          │ POST /api/menu-scan
                          │ body: { restaurant_id, images: base64[] }
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTE  /api/menu-scan                   │
│                                                                  │
│  a. Validate admin session (auth guard)                          │
│  b. Validate files (type: JPEG/PNG/WEBP/PDF, max 20MB each)      │
│  c. INSERT menu_scan_jobs (status: 'processing') → get job_id    │
│  d. Fan-out: call GPT-4o Vision in parallel for each image       │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼ (parallel per image)
┌──────────────────────────────────────────────────────────────────┐
│              GPT-4o Vision API  (one call per image)             │
│                                                                  │
│  System prompt instructs model to:                               │
│  - Return strict JSON matching schema below                      │
│  - Language: auto-detect (Spanish / English)                     │
│  - Identify section headers as menu names and category names     │
│  - Detect dietary symbols (V, VG, GF, H, K, ★ spicy, etc.)      │
│  - Detect ingredient lists if present in parentheses/sub-text    │
│  - Assign confidence score (0.0–1.0) per dish                   │
│  - Leave fields null if not clearly present — do NOT guess       │
│  - Do NOT extract currency (handled separately)                  │
│                                                                  │
│  Output JSON per image:                                          │
│  {                                                               │
│    "menus": [                                                     │
│      {                                                           │
│        "name": "Lunch",          // null if no section header    │
│        "menu_type": "food",      // "food" | "drink"             │
│        "categories": [                                           │
│          {                                                       │
│            "name": "Appetizers",                                 │
│            "dishes": [                                           │
│              {                                                   │
│                "name": "Caesar Salad",                           │
│                "price": 12.50,                                   │
│                "description": "Romaine, croutons, parmesan",     │
│                "raw_ingredients": ["romaine", "croutons"],       │
│                "dietary_hints": ["vegetarian"],                  │
│                "spice_level": null,                              │
│                "calories": null,                                  │
│                "confidence": 0.95                                │
│              }                                                   │
│            ]                                                     │
│          }                                                       │
│        ]                                                         │
│      }                                                           │
│    ]                                                             │
│  }                                                               │
└──────────────┬───────────────────────────────────────────────────┘
               │ results from all images
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              SERVER-SIDE POST-PROCESSING                         │
│                                                                  │
│  1. MERGE multi-page results:                                    │
│     - Match menus by name (case-insensitive)                     │
│     - Match categories within same menu by name                  │
│     - Deduplicate dishes by exact name match                     │
│                                                                  │
│  2. INGREDIENT MATCHING (for dishes with raw_ingredients):       │
│     - Query ingredients_master by name + name_variants           │
│     - Fuzzy match using pg_trgm similarity (threshold 0.6)       │
│     - Tag each ingredient as: matched | unmatched                │
│                                                                  │
│  3. DISH CATEGORY INFERENCE:                                     │
│     - Query dish_categories table                                │
│     - LLM-assigned category suggestion based on dish name        │
│       (e.g. "Pizza Margherita" → dish_category: "Pizza")         │
│     - Stored as suggestion only — admin confirms in review       │
│                                                                  │
│  4. DIETARY TAG MAPPING:                                         │
│     - Map dietary_hints strings → dietary_tags.code values       │
│       (e.g. "vegetarian" → "vegetarian", "GF" → "gluten_free")  │
│                                                                  │
│  5. CURRENCY ATTACHMENT:                                         │
│     - Read restaurant.primary_currency (or derive from           │
│       country_code if not set)                                   │
│     - Attach to all price values in result                       │
│                                                                  │
│  6. UPDATE menu_scan_jobs:                                       │
│     - result_json = merged + enriched JSON                       │
│     - status = 'needs_review'                                    │
│     - dishes_found = total dish count                            │
└──────────────┬───────────────────────────────────────────────────┘
               │ enriched JSON (stored in menu_scan_jobs.result_json)
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              ADMIN REVIEW UI  (same /admin/menu-scan page)       │
│                                                                  │
│  Layout: Two-panel view                                          │
│  ┌────────────────────┬─────────────────────────────────────┐    │
│  │  Image(s) viewer   │  Extracted data table               │    │
│  │  (Blob URL, no     │  ┌─────┬──────────┬───────┬──────┐  │    │
│  │   upload needed)   │  │Menu │ Category │ Dish  │Price │  │    │
│  │                    │  ├─────┼──────────┼───────┼──────┤  │    │
│  │  If multiple pages │  │Lunch│Appetizers│Caesar │$12.50│  │    │
│  │  → image carousel  │  │     │          │ Salad │      │  │    │
│  └────────────────────┘  └─────┴──────────┴───────┴──────┘  │    │
│                                                                  │
│  Each dish row features:                                         │
│  - Inline editable fields (click to edit name/price/desc)        │
│  - Confidence badge: green ≥ 0.85 | yellow 0.6–0.85 | red < 0.6 │
│  - Low-confidence rows auto-expanded for review                  │
│  - Ingredient chips with ⚠️ badge for unmatched ones             │
│    → "+ Add to DB" button → slide-over mini-form (see §8)        │
│  - Dish category dropdown (from dish_categories table)           │
│  - Dietary tag multi-select                                      │
│  - Delete row button                                             │
│                                                                  │
│  Toolbar actions:                                                │
│  - "Approve All" (high-confidence items)                         │
│  - "Delete All Low-Confidence" (< 0.6)                           │
│  - "Add Missing Dish" (manual row insertion)                     │
│  - "Save & Commit" (triggers Stage 5)                            │
└──────────────┬───────────────────────────────────────────────────┘
               │ confirmed payload (admin clicks "Save & Commit")
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              DATABASE COMMIT  /api/menu-scan/confirm             │
│                                                                  │
│  Transaction (all or nothing):                                   │
│                                                                  │
│  For each menu in confirmed data:                                │
│  1. INSERT INTO menus (restaurant_id, name, menu_type, ...)      │
│     → get menu_id                                                │
│                                                                  │
│  For each category:                                              │
│  2. INSERT INTO menu_categories (menu_id, name, ...)             │
│     → get category_id                                            │
│                                                                  │
│  For each dish:                                                  │
│  3. INSERT INTO dishes (restaurant_id, menu_category_id,         │
│       name, price, description, calories, spice_level,          │
│       dish_category_id, dietary_tags, is_available=true)         │
│     → get dish_id                                                │
│                                                                  │
│  4. INSERT INTO dish_ingredients (dish_id, ingredient_id)        │
│     for each matched ingredient                                  │
│                                                                  │
│  5. DB TRIGGER fires automatically:                              │
│     calculate_dish_allergens() → updates dishes.allergens        │
│     + populates dishes.dietary_tags from ingredients             │
│                                                                  │
│  6. UPDATE menu_scan_jobs SET                                    │
│       status = 'completed',                                      │
│       dishes_saved = N                                           │
│                                                                  │
│  7. Redirect to restaurant detail page in admin panel            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. New Database Table

**Migration: `034_add_menu_scan_jobs.sql`**

```sql
CREATE TABLE menu_scan_jobs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Source
  image_count     SMALLINT    NOT NULL DEFAULT 1,
  image_filenames TEXT[],                       -- original filenames for UI display

  -- Processing state
  status          TEXT        NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'needs_review', 'completed', 'failed')),

  -- AI output
  ocr_raw_text    TEXT,                         -- reserved for future OCR-stage debugging
  result_json     JSONB,                        -- merged, enriched extraction result
  error_message   TEXT,                         -- set on failure

  -- Stats
  dishes_found    INTEGER     DEFAULT 0,
  dishes_saved    INTEGER     DEFAULT 0,
  processing_ms   INTEGER,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX menu_scan_jobs_restaurant_idx ON menu_scan_jobs(restaurant_id);
CREATE INDEX menu_scan_jobs_status_idx ON menu_scan_jobs(status);
CREATE INDEX menu_scan_jobs_created_by_idx ON menu_scan_jobs(created_by);

-- RLS
ALTER TABLE menu_scan_jobs ENABLE ROW LEVEL SECURITY;

-- Admin only (matches existing admin role check pattern)
CREATE POLICY "Admins can manage menu scan jobs"
  ON menu_scan_jobs
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );
```

---

## 12. LLM Prompt Design

The system prompt is critical and will need iteration. Starting template:

```
You are a menu data extraction assistant. Given an image of a restaurant menu,
extract all dishes and return them as structured JSON.

RULES:
- Return ONLY valid JSON — no prose, no markdown fences.
- Do NOT hallucinate. If a field is not clearly visible, set it to null.
- Identify section headers as "menu name" (e.g. Breakfast, Lunch, Dinner, Bebidas)
  and sub-headers as "category name" (e.g. Entradas, Pastas, Postres).
- Detect dietary symbols: V or (V) = vegetarian, VG or (VG) = vegan,
  GF = gluten_free, H = halal, K = kosher, ★ or 🌶 = spicy.
- If ingredients are listed (usually in parentheses after the dish name),
  extract them as a list of strings. Otherwise set raw_ingredients to null.
- Confidence score: 1.0 = clearly legible, 0.5 = partially obscured, 0.0 = guess.
- Do NOT extract or infer currency. Leave all prices as plain numbers.
- The menu may be in Spanish or English. Handle both. Keep dish names in their
  original language.

OUTPUT JSON SCHEMA:
{
  "menus": [
    {
      "name": string | null,
      "menu_type": "food" | "drink",
      "categories": [
        {
          "name": string | null,
          "dishes": [
            {
              "name": string,
              "price": number | null,
              "description": string | null,
              "raw_ingredients": string[] | null,
              "dietary_hints": string[],
              "spice_level": 0|1|2|3|4 | null,
              "calories": number | null,
              "confidence": number
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 13. Implementation Plan

### Phase 1 — Backend Foundation

- [ ] Write migration `034_add_menu_scan_jobs.sql`
- [ ] Set up `OPENAI_API_KEY` in `.env.local` (and Vercel environment variables)
- [ ] Create Next.js API route `POST /api/menu-scan`:
  - Admin auth guard
  - File validation (type + size)
  - INSERT `menu_scan_jobs` record
  - Fan-out parallel GPT-4o Vision calls
  - Merge multi-page results
  - Ingredient fuzzy matching against `ingredients_master`
  - Dish category suggestion
  - Dietary tag code mapping
  - Currency from `restaurants.primary_currency` / `country_code`
  - UPDATE `menu_scan_jobs` with result
- [ ] Create Next.js API route `POST /api/menu-scan/confirm`:
  - Validate confirmed payload
  - Transaction: INSERT menus → menu_categories → dishes → dish_ingredients
  - UPDATE `menu_scan_jobs.status = 'completed'`
- [ ] Create Next.js API route `POST /api/ingredients` (add new ingredient inline):
  - INSERT `ingredients_master`
  - INSERT `ingredient_allergens` junction rows
  - INSERT `ingredient_dietary_tags` junction rows

### Phase 2 — Admin UI

- [ ] New admin page: `apps/web-portal/app/admin/menu-scan/page.tsx`
- [ ] Restaurant selector component (reuse or adapt existing)
- [ ] Multi-image upload area (drag-and-drop, supports 1–10 images)
- [ ] Image carousel component (to display multiple pages during review)
- [ ] Extracted data table component with inline editing:
  - Grouped by Menu → Category → Dishes
  - Confidence colour coding
  - Editable cells (name, price, description)
  - Dietary tag multi-select
  - Dish category dropdown
  - Ingredient chips with unmatched ⚠️ state
- [ ] Slide-over "Add Ingredient" panel (connects to `POST /api/ingredients`)
- [ ] Toolbar (Approve All, Delete Low-Confidence, Add Row, Save & Commit)
- [ ] Job history list (show past scans per restaurant, status, dishes_found/saved)
- [ ] Add "Menu Scan" link to `AdminSidebar`

### Phase 3 — Hardening & Iteration

- [ ] Prompt iteration based on real Spanish menus (tune confidence thresholds)
- [ ] Handle PDF input (convert pages to JPEG via `pdf-to-img` or similar before sending to GPT-4o)
- [ ] Add retry logic for failed GPT-4o calls (exponential backoff)
- [ ] Rate limiting: max 20 images per request to prevent runaway costs
- [ ] Optional: cost tracking — log token counts per job in `menu_scan_jobs`
- [ ] Optional: "Save image to storage" toggle for audit trail

---

## 14. Key Files to Create / Modify

| File                                                       | Action | Notes                      |
| ---------------------------------------------------------- | ------ | -------------------------- |
| `infra/supabase/migrations/034_add_menu_scan_jobs.sql`     | Create | New table                  |
| `apps/web-portal/app/api/menu-scan/route.ts`               | Create | Main extraction endpoint   |
| `apps/web-portal/app/api/menu-scan/confirm/route.ts`       | Create | DB commit endpoint         |
| `apps/web-portal/app/api/ingredients/route.ts`             | Create | Inline ingredient addition |
| `apps/web-portal/app/admin/menu-scan/page.tsx`             | Create | Main admin UI page         |
| `apps/web-portal/components/admin/MenuScanUpload.tsx`      | Create | Upload widget              |
| `apps/web-portal/components/admin/MenuScanReviewTable.tsx` | Create | Editable review table      |
| `apps/web-portal/components/admin/AddIngredientPanel.tsx`  | Create | Slide-over ingredient form |
| `apps/web-portal/components/admin/AdminSidebar.tsx`        | Modify | Add "Menu Scan" nav item   |
| `apps/web-portal/lib/menu-scan.ts`                         | Create | Shared types + merge logic |

---

## 15. Open Questions (Resolved)

| Question            | Answer                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Volume              | ~1,000 restaurants/month, avg 2 images = ~2,000 images/month                               |
| Image quality       | Phone photos, often angled or with glare → GPT-4o Vision handles better than OCR-then-text |
| Languages           | Spanish primary, English secondary, others future                                          |
| Who uses it         | Admin only                                                                                 |
| Existing menus      | New restaurants only; multi-page → merge by section name                                   |
| Architecture choice | GPT-4o Vision single-stage                                                                 |
| Storage             | No Supabase Storage for images; only result JSON in DB                                     |
| Currency            | From `restaurants.primary_currency` / `country_code`, never from image                     |

---

_Document owner: Admin_  
_Review before implementation: confirm API key billing limits and OpenAI rate limits for parallel calls._
