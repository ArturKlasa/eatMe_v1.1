# Phase 10: Admin Editor Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 10-admin-editor-refactor
**Areas discussed:** Decomposition seams, buildConfirmPayload fn, Real regression gate

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Decomposition seams | Reconcile SC#1's component names to the real regions | ✓ |
| buildConfirmPayload fn | Pure fn vs closure; where validation lives | ✓ |
| Real regression gate | The named test doesn't import the component — what proves the shape? | ✓ |
| Orchestration state | Extract hooks vs keep orchestration in parent | (not selected → default applied: keep in parent, D-06) |

---

## Decomposition seams

| Option | Description | Selected |
|--------|-------------|----------|
| DishCard + CategorySection + helpers | Dir + barrel; DishCard (whole per-dish), CategorySection (group header), reviewHelpers.ts pure module, BundledItemsBlock → own file | ✓ |
| Also split DishFieldsForm out of DishCard | Same, plus carve the field grid into its own component to literally honor SC#1's name | |
| Coarser — modules only | Extract only pure modules + buildConfirmPayload, leave JSX inline | |

**User's choice:** DishCard + CategorySection + helpers (Recommended).
**Notes:** SC#1's literal names (DishFieldsForm/ModifierGroupsEditor/DishImagePanel) reinterpreted — ModifierGroupsEditor already exists; no image panel in this file (SourceImageStrip is parent-owned). → D-01..D-06.

---

## buildConfirmPayload fn

| Option | Description | Selected |
|--------|-------------|----------|
| Pure fn; validation stays in handleSave | buildConfirmPayload pure + exported; handleSave keeps UI-coupled validation + single submit | ✓ |
| Pure buildConfirmPayload AND pure validateDishes | Also extract validation into a pure fn | |
| Keep as inner closure | No module extraction | |

**User's choice:** Pure fn; validation stays in handleSave (Recommended).
**Notes:** Payload shape byte-identical; pure fn takes plain data/predicates (no component-state closure). → D-07, D-08. Pure validateDishes captured as deferred.

---

## Real regression gate

| Option | Description | Selected |
|--------|-------------|----------|
| buildConfirmPayload snapshot test + operator browser save | Targeted snapshot on the pure builder + one in-browser save; existing tests stay green | ✓ |
| buildConfirmPayload snapshot test only | No operator browser step | |
| Operator browser save only — no new test | Rely on typecheck + manual save | |

**User's choice:** snapshot test + operator browser save (Recommended).
**Notes:** Surfaced that admin-confirm-rpc.test.ts does NOT import the component (passes regardless) → it is not the editor-payload proof. → D-09, D-10, D-11.

---

## Claude's Discretion

- DishCard internal granularity (nested DishFieldsGrid vs inline).
- buildConfirmPayload exact signature (getGroupMeta vs narrower predicate).
- reviewHelpers as one file vs helpers + types.

## Deferred Ideas

- Finer DishFieldsForm split out of DishCard.
- Pure validateDishes() extraction.
- Making getGroupMeta pure / broader category-model refactor.
