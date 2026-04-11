# Requirements Clarification

Interactive Q&A to refine the refactoring scope and approach.

All answers below are research-based proposals for user review.

---

## Q1: Priority Ranking

**Question:** Of the improvement areas identified, how should they be ranked in order of importance?

**Proposed Answer:**

1. **Code quality** — shared packages, deduplication, consistent patterns
2. **AI friendliness** — CLAUDE.md, splitting oversized files, expanding AI-ready surface
3. **Comment coverage** — JSDoc on exports, documenting magic numbers, enforcing standards
4. **LOC reduction** — dead code removal, style factory simplification, consolidation
5. **Developer productivity** — quality gates, pre-commit hooks, test infrastructure
6. **Test coverage** — mobile tests, shared test utilities, e2e tests

**Rationale:** Code quality is the foundation — industry research shows AI agents perform best on healthy code (CodeScene: Code Health 9.5+/10). Fixing duplication and structure first makes all subsequent AI-assisted work more effective. AI friendliness is second because it directly enables faster future development. Comment coverage and LOC reduction are mid-tier because they're high-value but lower-risk. Developer productivity (CI/hooks) and test coverage are last — important but the largest effort and can be done incrementally.

---

## Q2: Scope — All Apps at Once or Incremental?

**Question:** Should we refactor all apps (web portal, mobile, packages) simultaneously, or focus on one at a time?

**Proposed Answer:** Incremental, in this order:
1. **Shared packages first** — create `@eatme/shared`, extract constants/types/validation
2. **Web portal second** — it has existing tests as a safety net, and the most complex files to split
3. **Mobile third** — adapt to use shared packages, split oversized files
4. **Infrastructure last** — CLAUDE.md, CI/CD, quality gates

**Rationale:** The shared packages must come first because both apps depend on them — extracting shared code creates the foundation. Web portal has test coverage (45+ test files) that acts as a regression safety net during refactoring. Mobile has zero tests, so refactoring it is riskier and should come after patterns are established. Barrel exports in both apps make file-level reorganization safe without breaking imports.

---

## Q3: CLAUDE.md Strategy

**Question:** How should CLAUDE.md relate to the existing `.github/copilot-instructions.md` (332 lines)?

**Proposed Answer:** Create a concise CLAUDE.md (<100 lines) that references existing docs via progressive disclosure.

- **CLAUDE.md** — project overview, key commands, architecture pointers, terminology, links to `agent_docs/`
- **Keep copilot-instructions.md** — it's GitHub Copilot-specific and comprehensive; don't duplicate it
- **Create `agent_docs/`** — separate files for building, testing, conventions, database schema (referenced from both CLAUDE.md and copilot-instructions.md)

**Rationale:** Industry best practice (HumanLayer) says CLAUDE.md should be <200 lines. The copilot-instructions.md already covers 80% of what's needed, but Claude Code doesn't read it automatically. Rather than duplicating, CLAUDE.md should be a concise hub pointing to detailed docs. "Never send an LLM to do a linter's job" — code style stays in ESLint config.

---

## Q4: Shared Package Architecture

**Question:** Should we create new packages or extend existing ones to eliminate duplication?

**Proposed Answer:** Create one new package: `@eatme/shared`.

```
packages/shared/src/
├── constants/       # cuisines, allergens, dietary tags, pricing, etc.
│   ├── cuisine.ts
│   ├── dietary.ts
│   ├── menu.ts
│   ├── pricing.ts
│   └── restaurant.ts
├── types/           # domain types used by both apps
│   └── restaurant.ts
├── validation/      # Zod schemas (optional peer dep)
│   └── restaurant.ts
└── index.ts
```

**Do NOT extend `@eatme/database`** — it's scoped to Supabase client/types. Adding unrelated constants violates single responsibility.

**Rationale:** Research found ~800 LOC of duplication across constants (manually synced with "Keep in sync" comments), types (overlapping interfaces), and validation schemas (web-only, but shareable). Mobile's cuisine list has 4 extra entries ("Asian", "Comfort Food", "Fine Dining", "International") that need merging into a canonical list. One new package is the minimal approach that eliminates all duplication while keeping concerns clean.

---

## Q5: File Splitting Strategy for Oversized Files

**Question:** How should the 3 critical oversized files (1,000+ lines) be split?

**Proposed Answer:**

### useMenuScanState.ts (1,378 lines) → 6 files
- `useMenuScanStep.ts` — step state machine (upload → processing → review → done)
- `useMenuScanUpload.ts` — restaurant selection, file handling, drag-drop (~285 lines)
- `useMenuScanProcessing.ts` — API calls, image resizing (~120 lines)
- `useMenuScanReview.ts` — menu/dish editing, ingredient resolution (~450 lines)
- `useMenuScanGroups.ts` — batch filtering, duplicate flagging (~150 lines)
- `useMenuScanTypes.ts` — all exported types (~50 lines)

### MenuScanReview.tsx (1,265 lines) → 7 files
- `ReviewHeader.tsx` — title, dish count, action buttons (~40 lines)
- `ReviewLeftPanel.tsx` — images + details tab container (~140 lines)
- `ImageCarousel.tsx` — image preview and pagination (~90 lines)
- `RestaurantDetailsForm.tsx` — address, city, location picker (~90 lines)
- `MenuExtractionList.tsx` — menu/category/dish rendering (~450 lines)
- `DishEditPanel.tsx` — expanded dish details, ingredients (~300 lines)
- `ImageZoomLightbox.tsx` — full-screen viewer (~60 lines)

### RestaurantDetailScreen.tsx (1,003 lines) → 9 files
- `useRestaurantDetail.ts` — state, loading, rating, favorites (~200 lines)
- `RestaurantMetadata.ts` — helper functions (~40 lines)
- `DishGrouping.ts` — groupDishesByParent logic (~50 lines)
- `DishFiltering.ts` — sorting and classification (~30 lines)
- `RestaurantHeader.tsx` — name, info, favorite, actions (~150 lines)
- `RestaurantHourSection.tsx` — hours display (~100 lines)
- `MenuCategorySection.tsx` — category tabs, lazy-loaded dishes (~200 lines)
- `DishCard.tsx` — individual dish display (~100 lines)
- `DishDetailModal.tsx` — selected dish expanded view (~150 lines)

### common.ts (1,202 lines) — restructure into ~10 modules
Split by concern (factories, typography, containers, buttons, forms, cards, modals, spacing). Reduce ~200 lines through systematic factory composition.

**Rationale:** All four files have clear natural boundaries (section comments, distinct state groups, separate render sections). Barrel exports in both apps mean internal reorganization won't break external imports. Priority: useMenuScanState (high impact, improves hook composability) → common.ts (reduces duplication) → RestaurantDetailScreen → MenuScanReview (depends on useMenuScanState split).

---

## Q6: Comment & JSDoc Strategy

**Question:** What comment/JSDoc approach should we adopt and how should it be enforced?

**Proposed Answer:**

**Standard:**
- All exported functions get JSDoc with `@param`, `@returns`, and `@throws` where applicable
- All magic numbers get inline comments explaining rationale
- Complex business logic gets "why" comments (not "what")
- Module-level doc comments on all files explaining purpose
- Follow the existing good patterns: `packages/database/src/client.ts` (WHY explanations), `apps/mobile/src/services/ratingService.ts` (full JSDoc blocks)

**Enforcement:**
- Add `eslint-plugin-jsdoc` with rules: `require-jsdoc` on exports, `require-param`, `require-returns`
- Configure as warnings first (not errors) to allow incremental adoption
- Add to Turbo pipeline so it runs with `turbo lint`

**Scope:**
- Web portal: raise from 40% to 80%+ coverage on lib/, hooks/, API routes
- Mobile: maintain 85% coverage, add JSDoc to store actions and service exports
- Packages: maintain 91%, ensure all new shared code is fully documented

**Rationale:** Only 49 JSDoc annotations exist across the entire codebase despite good informal comment patterns. The mobile app (85% comment coverage) is better than web portal (40%). Starting with warnings allows gradual adoption without blocking development. The existing good examples serve as templates.

---

## Q7: Breaking Changes & Safety

**Question:** How aggressive can we be with refactoring? What safety measures are needed?

**Proposed Answer:** **Moderately aggressive with safety rails.**

**Safe to refactor freely:**
- Component internal structure (barrel exports protect external imports)
- Hook logic splitting (internal reorganization)
- Service layer cleanup
- Style file restructuring

**Requires coordination:**
- Shared package exports (6 import sites for `@eatme/database`, 16+ for `@eatme/tokens`)
- `next.config.ts` transpilePackages list (must update when adding `@eatme/shared`)
- Build scripts (root `package.json` runs `pnpm --filter @eatme/tokens generate:css`)

**Safety measures:**
- Run `turbo build && turbo lint && turbo check-types` after each phase
- Web portal: run existing test suite as regression check
- Manual smoke test mobile app after changes (no automated tests)
- Git branch per phase with frequent commits as save points

**Rationale:** No external npm consumers exist — only the two local apps consume shared packages via `workspace:*`. Supabase edge functions use external CDN imports only, so they're unaffected. Barrel exports in both apps mean file-level moves are safe. The main risk is mobile (zero tests) — manual verification needed.

---

## Q8: LOC Reduction Approach

**Question:** What's the strategy for reducing lines of code without sacrificing readability?

**Proposed Answer:**

| Category | Estimated Savings | Approach |
|----------|-------------------|----------|
| Shared package extraction | ~800 LOC | Deduplicate constants/types/validation |
| Mobile style factories | ~600 LOC | Systematic factory composition in common.ts |
| Verbose patterns | ~200 LOC | Optional chaining, nullish coalescing, destructuring |
| Dead code & console.logs | ~50 LOC | Remove console.logs, commented-out code |
| Test mock consolidation | ~100 LOC | Shared test utilities |
| **Total** | **~1,750 LOC** | ~2.6% of 68K total |

**NOT pursuing:**
- Removing useful comments to reduce LOC (counterproductive)
- Aggressive minification of readable code
- Removing defensive error handling

**Rationale:** The ~1,750 LOC reduction is conservative but meaningful — it eliminates genuine redundancy without sacrificing readability. The biggest wins come from deduplication (shared packages) and style factory simplification, not from squeezing existing logic. File splitting increases file count but doesn't increase LOC.

---

## Q9: Developer Productivity — CI/CD & Quality Gates

**Question:** What quality gates and CI tooling should be added?

**Proposed Answer:**

**Phase 1 (During refactor):**
- Add `test` task to `turbo.json` pipeline
- Wire up existing Vitest for web portal into Turbo

**Phase 2 (Post-refactor):**
- GitHub Actions CI workflow: `turbo build && turbo lint && turbo check-types && turbo test`
- Pre-commit hooks via Husky + lint-staged (lint + type-check on staged files)
- `eslint-plugin-jsdoc` warnings in ESLint config

**Phase 3 (Future):**
- Mobile test infrastructure (Jest or Vitest with React Native Testing Library)
- Coverage thresholds on PRs
- E2E tests for critical paths

**Rationale:** Currently there are zero automated quality gates — no GitHub Actions, no pre-commit hooks, no test task in Turbo. The existing web portal tests (45+ files) are never run in CI. Phase 1 is a quick win to leverage what exists. Phase 2 establishes enforcement. Phase 3 is aspirational and can be tackled separately.

---

## Q10: Incremental Delivery Strategy

**Question:** Should this be one large refactor PR or broken into smaller deliverables?

**Proposed Answer:** **Multiple phases, each a separate PR.**

1. **Phase 1: Foundation** — Create `@eatme/shared` package, extract constants/types/validation, update imports in both apps
2. **Phase 2: AI readiness** — Create CLAUDE.md + agent_docs/, split oversized files (useMenuScanState, MenuScanReview, RestaurantDetailScreen, common.ts)
3. **Phase 3: Code quality** — JSDoc coverage pass, remove dead code/console.logs, simplify verbose patterns
4. **Phase 4: Infrastructure** — Add test to Turbo pipeline, GitHub Actions CI, pre-commit hooks, eslint-plugin-jsdoc

Each phase is independently shippable and testable. Phases can be done sequentially or some in parallel.

**Rationale:** Industry best practice (FreeCodeCamp, Graphite) strongly favors incremental refactoring over big-bang. Each phase delivers measurable value and can be verified independently. If any phase reveals unexpected issues, it doesn't block the others.
