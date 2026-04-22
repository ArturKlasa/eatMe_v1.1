# Summary — Dish Ingestion & Menu-Scan Review Rework

_Planning complete: 2026-04-22_

This document lists every artifact produced during this PDD planning cycle, a brief overview of what was decided, and the suggested next steps.

## Artifacts

```
.agents/planning/2026-04-22-ingestion-improvements/
├── rough-idea.md                        — original one-line idea + expanded pain points
├── idea-honing.md                       — 12 questions of requirements clarification, with user answers
├── research/
│   ├── historical-context.md            — prior planning cycles (2026-04-05, 2026-04-06, 2026-04-10)
│   ├── menu-scan-review-page.md         — current architecture of the review page
│   ├── ingestion-data-model.md          — current dish-kind schema + data-coupling audit
│   ├── menu-taxonomies-external.md      — industry taxonomies (Schema.org, Toast, Square, DoorDash)
│   └── user-taxonomy-proposal.md        — 11 core + 20 edge patterns supplied by user
├── design/
│   └── detailed-design.md               — standalone design doc with mermaid diagrams (v1.0)
├── implementation/
│   └── plan.md                          — 18-step implementation plan with checklist
└── summary.md                           — this document
```

## Overview

### What we're building

A two-part rework:

1. **Dish `kind` taxonomy redesign** — replace the current 4-value enum (`standard | template | experience | combo`) with a 5-value composition-shape enum (`standard | bundle | configurable | course_menu | buffet`), plus two orthogonal fields (`status`, `is_template`) and two new tables (`dish_courses`, `dish_course_items`) that model prix-fixe and tasting menus cleanly.
2. **Menu-scan review page rework** — keep the step-based flow (upload → processing → review → done) intact, but replace the review step's state layer (Zustand) and right-panel surfaces (new `DishEditPanelV2`, `KindSelectorV2`, `VariantEditor`, `CourseEditor`, `PageGroupedList`, `FlaggedDuplicatePanel`, `SavePreviewModal`, `UndoToast`, keyboard shortcuts, actionable warnings).

### What admins get

- Draft autosave (no more work lost on tab refresh)
- Every dish shows which source image produced it; click to jump
- Save preview + 15-min soft undo
- Confidence-flagged dishes surface to the top
- Clear Kind choice with no silent price hiding
- Tasting/prix-fixe menus editable with a real course editor
- "Why flagged" breakdown + side-by-side comparison for duplicates
- Keyboard shortcuts for bulk review
- Clickable warnings with "fix with default" actions

### What's explicitly out of scope

Restaurant ingestion improvements; mobile responsive (web portal is laptop-only); kids menu; happy-hour / time-based pricing; seasonal/date-ranged availability; daypart categorization; region-level source linkage; merge-preview UI; cross-device draft; full audit-log history; full keyboard-first flow; flipping the ingredient-entry feature flag; category-level / shared add-ons / location-based / rotating menus.

### Key decisions and why

| Decision | Chosen | Why |
|---|---|---|
| Kind taxonomy approach | Hybrid (D) — rename `combo→bundle`, `template→configurable`+`is_template=true`, split `experience→course_menu|buffet` | Un-conflates template-as-state and experience-as-two-things without full rebuild. |
| Course menu modeling | Option 2 — two new tables | Option 1 (overloaded option_groups) rots; Option 3 (full sequence graph) over-engineers. |
| Review page rework | Approach C Hybrid — keep shell, replace state layer + right panel | Upload/processing aren't pain points; rot is in the state layer. |
| State library | Zustand | Matches mobile; testable; slice pattern fits hook decomposition. |
| Rollout | No feature flag — single coordinated PR | User preference (Q9.2); implies coordinated deploy. |
| Mobile coordination | Lagging 1–2 weeks | Cosmetic-only coupling; low risk of drift. |
| Source-image linkage | Page-level now; reserve `source_region` column for later | Deterministic, ships in hours; region-level is a later cycle. |
| Save safety | localStorage draft + confirm modal + 15-min soft undo | Middle-path that solves the core risks cheaply. |
| Test coverage target | Thorough hooks/reducers; component smoke tests | Protects the new state layer without brittle rendering tests. |

## Implementation plan overview

**18 numbered steps**, each demoable in isolation:

| Steps | Phase | Effect |
|---|---|---|
| 1 | DB migration (additive + auto-rename + new tables + feed RPC) | Schema foundations land |
| 2 | Shared types (transitional union) + fixture sweep | Types compile; no regressions |
| 3 | AI extraction + enrich-dish updates | Extraction emits new kinds |
| 4 | Confirm + soft-undo endpoints | Full save/undo path server-side |
| 5 | Experience triage admin page + audit log | Admins can reclassify legacy rows |
| 6 | Tighten CHECK migration (**post-deploy, operationally gated**) | Lock enum after triage |
| 7–10 | Zustand store + page shell (functional parity) | Prop-drilling gone; UI unchanged |
| 11 | DishEditPanelV2 + KindSelectorV2 + VariantEditor | No more silent price hiding |
| 12 | CourseEditor | Tasting / prix-fixe editable |
| 13 | PageGroupedList + source-image chip | "Which image did this dish come from?" solved |
| 14 | FlaggedDuplicatePanel (why-flagged + side-by-side) | Dedup decisions transparent |
| 15 | SavePreviewModal + UndoToast | Safe save with preview + undo |
| 16 | useKeyboardShortcuts + actionable warnings | Bulk review ergonomics |
| 17 | Mobile kind-badge update | RN handles new values |
| 18 | Merge prep: narrow DishKind type + cleanup + docs + manual checklist | Release-ready |

## Next steps

### Immediate — planning follow-ups

1. **Review `design/detailed-design.md`** if you want to verify the full spec before committing. It's standalone and readable without the other docs.
2. **Review `implementation/plan.md`** as a pre-execution checklist. The 18-step checklist at the top is designed to be ticked off in order.

### Implementation — when you're ready

Per the PDD SOP's "Ralph Loop Handoff":

> After the planning session is complete and the user wants implementation, tell them how to start the Ralph loop themselves.
>
> Suggest one of these commands:
> - `ralph run --config presets/pdd-to-code-assist.yml --prompt "<task>"`
> - `ralph run -c ralph.yml -H builtin:pdd-to-code-assist -p "<task>"`
>
> You MUST NOT start the loop or begin implementation yourself. This SOP ends after planning and handoff.

When you're ready to begin implementation, you can kick off a Ralph loop against the plan. Alternatively — since this repo uses the GSD workflow (visible in `.planning/`) — you may prefer to run the implementation through a GSD flow (`/gsd-plan-phase` → `/gsd-execute-phase`) using this plan as the specification input.

Either way, **I will not start implementation myself.** The planning session ends here.

## Areas that may need further refinement

These are not gaps — they're decisions that were deliberately deferred to implementation-time because the right answer depends on seeing real code or real data:

1. **Course-item linking (`links_to_dish_id`)** — default NULL this cycle; revisit after the first real tasting-menu extraction.
2. **`display_price_prefix='flat_rate'`** — consider adding if `per_person` feels wrong for buffets with tiered pricing. Decide on first real case.
3. **Virtualization threshold** — currently deferred entirely; flip on only if admins report lag on real menus.
4. **Admin triage "auto-classify by keywords"** — test heuristics with production data before enabling as default.
5. **Confidence threshold (default 0.7)** — tunable via env var post-launch; first value is a guess.

## Known risks heading into implementation

- **Coordinated release complexity.** No feature flag means web and DB migration must deploy together. Operationally a little tighter than a flag-gated rollout; reward is simpler codepaths and less drift.
- **Admin triage blocks Step 6 + Step 18 narrow type.** If triage drags on in production, the final CHECK tightening and narrow `DishKind` union can't ship. Two release patterns in Step 18 give a way to proceed either way.
- **Zustand adoption in web-portal.** New dep; requires hook rewrites. Mitigated by keeping existing hook APIs as wrappers during Step 7.
- **Mobile kind-badge lag.** If a user has a stale mobile build during the 1–2 week window, they see no badge (not a crash). Acceptable.

## Sign-off

- Requirements: clarified through 12 bundled Q&A rounds; all decisions recorded in `idea-honing.md`.
- Research: 5 notes in `research/`, covering current code, prior plans, industry, user's taxonomy, and data coupling.
- Design: v1.0 in `design/detailed-design.md`; critical-reviewed and gap-patched.
- Plan: 18 steps in `implementation/plan.md`; critical-reviewed and gap-patched.

Ready for handoff.
