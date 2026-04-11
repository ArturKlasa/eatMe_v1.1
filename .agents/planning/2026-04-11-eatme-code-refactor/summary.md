# Project Summary: eatMe Codebase Refactor

## What Was Created

This planning session transformed a rough idea — "refactor eatMe apps for code quality, AI friendliness, and developer productivity" — into a comprehensive, actionable plan.

### Artifacts

```
.agents/planning/2026-04-11-eatme-code-refactor/
├── rough-idea.md                          # Original concept and codebase overview
├── idea-honing.md                         # 10 Q&A pairs refining scope, priorities, and approach
├── research/
│   ├── code-duplication.md                # ~800 LOC of duplication identified across apps
│   ├── comment-coverage.md                # 59% coverage overall; web portal at 40%, mobile at 85%
│   ├── ai-friendliness.md                 # 4.7/5 score — already strong, targeted improvements
│   ├── code-quality-loc.md                # ~1,750 LOC reduction potential identified
│   └── industry-best-practices.md         # 2026 best practices from CodeScene, Stack Overflow, Addy Osmani, HumanLayer
├── design/
│   └── detailed-design.md                 # Full design: 25 requirements, architecture diagrams, component specs, risk assessment
├── implementation/
│   └── plan.md                            # 22-step plan across 4 phases with checklist
└── summary.md                             # This document
```

## Design Overview

The refactor targets the eatMe monorepo (~68K LOC, 358 files) across 4 phases:

### Phase 1: Foundation — `@eatme/shared` Package (Steps 1–7)
Create a new shared package extracting ~800 LOC of duplicated constants, types, and validation schemas from web portal and mobile into a single source of truth. Wire Vitest into Turbo pipeline.

### Phase 2: AI Readiness — File Splits + Documentation (Steps 8–13)
Split 4 oversized files (1,000+ lines each) into focused modules, create CLAUDE.md with progressive disclosure via `agent_docs/`, and update the stale copilot-instructions.md.

### Phase 3: Code Quality — JSDoc + Cleanup (Steps 14–19)
Comprehensive JSDoc pass across all packages, document magic numbers, remove dead code and console.logs, simplify verbose patterns, and consolidate test mocks.

### Phase 4: Infrastructure — CI + Quality Gates (Steps 20–22)
Add `eslint-plugin-jsdoc` enforcement, Husky + lint-staged pre-commit hooks, and GitHub Actions CI pipeline.

### Key Numbers

| Metric | Current | Target |
|--------|---------|--------|
| Duplicated LOC | ~800 | 0 |
| Files > 1,000 lines | 4 | 0 |
| JSDoc annotations | 49 | Comprehensive on all exports |
| Total LOC reduction | — | ~1,750 |
| Web portal test files | 49 (not in CI) | 49 (in CI) |
| Quality gates | 0 | 3 (lint, pre-commit, CI) |
| AI guidance docs | copilot-instructions.md only | CLAUDE.md + agent_docs/ + copilot-instructions.md |

## Implementation Approach

- **22 steps** across **4 phases**, each a separate PR on a dedicated branch
- **Test-driven:** every code-changing step includes build/lint/type-check verification
- **Incremental:** each step produces demoable results; phases 2+3 can run in parallel
- **Safe:** barrel exports preserve all external imports; web portal's 49 tests serve as regression safety net; mobile gets manual smoke test checklists

## Next Steps

1. **Review the detailed design** at `design/detailed-design.md` — especially the component specs in Section 4 and risk assessment in Appendix D
2. **Review the implementation plan** at `implementation/plan.md` — the checklist at the top tracks progress across all 22 steps
3. **Begin implementation** following the plan, starting with Phase 1 Step 1

To start implementation with AI assistance, use:
- `ralph run --config presets/pdd-to-code-assist.yml --prompt "<task>"`
- `ralph run -c ralph.yml -H builtin:pdd-to-code-assist -p "<task>"`

## Areas That May Need Further Refinement

- **R18 (~600 LOC style factory savings):** The estimate is optimistic — actual savings depend on how many style properties are truly redundant vs intentionally different. May need adjustment during Step 13.
- **RestaurantForm.tsx local schemas (R4):** Step 5 notes to check whether `RestaurantForm.tsx`'s Zod schemas should consolidate into `@eatme/shared` or stay local. This needs a judgment call during implementation.
- **Vitest watch vs run mode (Step 7):** Two options documented — the team should decide which fits their local dev workflow before implementing.
- **lint-staged --max-warnings threshold (Step 21):** Depends on how many JSDoc warnings remain after Phase 3. May need to start without the threshold and add it later.
- **Mobile test infrastructure:** Explicitly deferred as a non-goal. Should be planned as a separate initiative after this refactor completes.
