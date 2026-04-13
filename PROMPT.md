# Research: AI Improvements for Restaurant Data Ingestion

## Goal

Produce a prioritised improvement roadmap for the AI-powered restaurant data
ingestion pipeline at EatMe. This is a **read-only research task** — no code
changes. The output is a set of markdown files under
`.agents/research/ai-ingestion-2026-04-12/`, culminating in a synthesized
roadmap at `00-roadmap.md`.

## Focus areas

1. **Data reliability** — silent correctness bugs, format drift, hallucination
   risk, truncation, retries, error handling
2. **Dish information richness** — fields in the `dishes` schema (or new fields)
   that AI could populate but doesn't; downstream impact on feed/ranker
3. **Ingredient/dietary accuracy** — matching quality, controlled vocabularies,
   cross-validation (e.g. ingredient ↔ allergen ↔ dietary-tag consistency)
4. **Prompt engineering** — few-shot examples, temperature calibration,
   Structured Outputs coverage, system prompt structure
5. **Architecture** — caching, queuing, re-enrichment, observability, provenance

## Scope

**In scope:**
- All four OpenAI call sites in the monorepo:
  - `apps/web-portal/app/api/menu-scan/route.ts` — GPT-4o Vision + translation
  - `apps/web-portal/app/api/menu-scan/suggest-ingredients/route.ts` — dish suggestion
  - `apps/web-portal/app/api/menu-scan/confirm/route.ts` — persistence
  - `infra/supabase/functions/enrich-dish/index.ts` — background enrichment + embeddings
- Prompts, models, parameters, response schemas
- DB fields that AI populates or could populate (`dishes`, `dish_ingredients`,
  `option_groups`, `ingredient_aliases`, `menu_scan_jobs`, `canonical_ingredients`)
- Cross-validation opportunities between AI output and deterministic rules
- Architecture around AI calls (queuing, caching, retries, observability, provenance)

**Out of scope:**
- Code changes — research only
- Non-AI features (auth, onboarding, restaurant management)
- Mobile app (no OpenAI calls there; all AI is server-routed)
- Replacing OpenAI with a different provider (decided: stay on OpenAI)

## Prior research (baseline — do not duplicate)

- `.agents/research/menu-scan-improvements.md` — 15 opportunities from a prior
  review. Items #1 (allergens to DB), #3 (enrichment_status=pending),
  #4 (GPT truncation warning), #7 (currency-aware thresholds),
  #9 (language fix), #10 (parallel PDF render), #14 (2000px resize) are
  already implemented. Items #2, #6, #8, #11, #12, #13, #15 are still open
  and should be cross-referenced rather than rewritten.

When a research topic overlaps with an existing baseline item, cite the baseline
and extend it with new angles (implementation detail, dependencies, alternatives)
rather than re-deriving the same finding.

## Acceptance criteria

- [ ] `.agent/scratchpad.md` contains a clear agenda with 6-10 topics,
      each marked [ ] or [x]
- [ ] Each agenda topic has a corresponding detail file under
      `.agents/research/ai-ingestion-2026-04-12/<slug>.md`
- [ ] `.agents/research/ai-ingestion-2026-04-12/00-roadmap.md` exists and contains:
      - Executive summary
      - Priority matrix (impact × effort × dependencies)
      - Quick-win bundle (XS effort)
      - Second wave (S/M effort)
      - Strategic bets (L effort, decisions needed)
      - Sequencing / dependency graph
      - Explicit "Not recommended" section
- [ ] Every "current behaviour" claim in every file cites `file:line`
- [ ] Every improvement opportunity has: title, current state, proposed change,
      impact (H/M/L), effort (XS/S/M/L), dependencies
- [ ] Every opportunity in the roadmap links back to its detail file
- [ ] No application code has been modified (verify with `git status` showing
      only files under `.agents/research/ai-ingestion-2026-04-12/` and
      `.agent/scratchpad.md` as changed)

## Output signal

When the synthesizer has completed the roadmap and all acceptance criteria pass,
emit `LOOP_COMPLETE`.
