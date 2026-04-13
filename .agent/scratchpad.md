## 2026-04-12 — Research: AI Improvements for Restaurant Data Ingestion

### Objective
Produce a prioritised improvement roadmap for EatMe's AI-powered restaurant data ingestion pipeline.
Output: `.agents/research/ai-ingestion-2026-04-12/00-roadmap.md` and supporting detail files.

### Research Agenda

- [x] TOPIC-01: prompt-engineering — Are prompts using Structured Outputs, few-shot examples, correct temperatures, and consistent allergen/dietary vocabularies across all four call sites?
  - Baseline: new (prior doc focused on extraction logic, not prompt structure)
  - Key files: `apps/web-portal/app/api/menu-scan/route.ts:83`, `suggest-ingredients/route.ts:86`, `enrich-dish/index.ts:105`
  - Output: `.agents/research/ai-ingestion-2026-04-12/01-prompt-engineering.md`

- [x] TOPIC-02: data-reliability — What silent correctness bugs, missing retries, error-handling gaps, and format drift risks exist across the four AI call sites?
  - Baseline: extends baseline #4 (truncation warning), #4 partial (retries), new for confirm atomicity
  - Key files: `route.ts:641-706`, `confirm/route.ts:97-281`, `enrich-dish/index.ts:444-524`
  - Output: `.agents/research/ai-ingestion-2026-04-12/02-data-reliability.md`

- [x] TOPIC-03: ingredient-matching — How accurate is the current ilike-based ingredient matching? What are the gap sources and what matching passes (tsvector, trigram, pgvector) could improve it?
  - Baseline: extends baseline #2 (ingredient matching quality), #11 (tsvector), #8 (alias pipeline)
  - Key files: `route.ts:300-365`, `suggest-ingredients/route.ts:180-225`, `enrich-dish/index.ts:370-380`
  - Output: `.agents/research/ai-ingestion-2026-04-12/03-ingredient-matching.md`

- [x] TOPIC-04: dietary-allergen-crossval — Is there cross-validation between allergens, dietary tags, and ingredients? Are controlled vocabularies consistent across endpoints?
  - Baseline: baseline #1 (allergens to DB — implemented), new cross-validation angle
  - Key files: `suggest-ingredients/route.ts:28-62`, `enrich-dish/index.ts:105-120`, `database_schema.sql:29-35`
  - Output: `.agents/research/ai-ingestion-2026-04-12/04-dietary-allergen-crossval.md`

- [x] TOPIC-05: dish-richness — Which dish schema fields could AI populate but currently doesn't? What's the downstream impact on feed ranking and consumer filtering?
  - Baseline: new
  - Key files: `database_schema.sql:125-165`, `enrich-dish/index.ts:206-280`, `confirm/route.ts:305-337`
  - Output: `.agents/research/ai-ingestion-2026-04-12/05-dish-richness.md`

- [x] TOPIC-06: enrichment-architecture — Is the enrichment pipeline (queue, retry, dedup, observability) robust for production scale? What architectural gaps exist?
  - Baseline: extends baseline #3 (enrichment_status=pending — implemented), new queue/observability angle
  - Key files: `enrich-dish/index.ts:283-562`, `confirm/route.ts:328-336`
  - Output: `.agents/research/ai-ingestion-2026-04-12/06-enrichment-architecture.md`

- [x] TOPIC-07: confidence-provenance — How is AI confidence tracked? Is there field-level provenance? Is there a feedback loop from admin edits to calibration?
  - Baseline: new
  - Key files: `enrich-dish/index.ts:176-204`, `confirm/route.ts:305-315`, `074_enrichment_review_status.sql`
  - Output: `.agents/research/ai-ingestion-2026-04-12/07-confidence-provenance.md`

- [x] TOPIC-08: open-baseline-items — Review the 7 still-open items from the prior baseline (#2, #6, #8, #11, #12, #13, #15) for updated status, new dependencies, and implementation detail.
  - Baseline: `.agents/research/old-menu-scan-improvements.md` items #2, #6, #8, #11, #12, #13, #15
  - Key files: per individual item
  - Output: `.agents/research/ai-ingestion-2026-04-12/08-open-baseline-items.md`

### Status
All 8 topics researched. Roadmap synthesized at `.agents/research/ai-ingestion-2026-04-12/00-roadmap.md`.
All acceptance criteria verified as met. Ready to emit LOOP_COMPLETE.
