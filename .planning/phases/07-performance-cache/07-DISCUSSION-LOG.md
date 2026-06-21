# Phase 7: Performance & Cache - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 07-performance-cache
**Areas discussed:** Cache invalidation design, Tiered-radius loop, Stage-2 payload reduction, hnsw.iterative_scan

---

## Area selection

| Option | Selected |
|--------|----------|
| Cache invalidation design | ✓ |
| Tiered-radius loop | ✓ |
| Stage-2 payload reduction | ✓ |
| hnsw.iterative_scan | ✓ |

**User's choice:** All four.

---

## Cache invalidation design (PERF-03 / SC#4)

### Q: Invalidation scope (flush-all vs targeted)
| Option | Selected |
|--------|----------|
| Keep flush-all, document it | ✓ |
| Targeted purge via tag-set | |
| Cap the blast, not eliminate | |

**User's choice:** Keep flush-all, document it.

### Q: Wiring location for INSERT/UPDATE/DELETE coverage
| Option | Selected |
|--------|----------|
| Tracked migration (codify drift) | ✓ |
| Operator dashboard handoff | |
| Both: migration + handoff | |

**User's choice:** Tracked migration (codify drift).
**Notes:** Cache key is restaurant-agnostic so targeted purge needs a key redesign; user chose to document flush-all as deliberate. Webhook secrets (function URL + auth) flagged as a research item.

---

## Tiered-radius loop (PERF-01 / SC#1)

### Q: Tier shape
| Option | Selected |
|--------|----------|
| Fractions of requested radius | ✓ |
| Multiplicative from a fixed floor | |
| Fixed absolute tiers | |

### Q: Stop condition
| Option | Selected |
|--------|----------|
| Healthy ranking pool (~100) | ✓ |
| Just the response limit (~20) | |
| Near the cap (~200) | |

### Q: Radius ceiling
| Option | Selected |
|--------|----------|
| Never exceed requested radius | ✓ |
| Allow bounded overshoot when sparse | |

**User's choice:** Fractions of requested radius; stop at ~100; never exceed requested radius.

---

## Stage-2 payload reduction (PERF-02 / SC#3)

### Q: Primary payload lever
| Option | Selected |
|--------|----------|
| SQL per-restaurant pre-cap | ✓ |
| Lean candidates + hydrate survivors | |
| Trim unread columns only | |

**User's choice:** SQL per-restaurant pre-cap.
**Notes:** Lean+hydrate rejected to avoid reintroducing the second round-trip migration 167 removed. Full JS→SQL scoring move is out of scope (PERF-V2-02).

---

## hnsw.iterative_scan (PERF-01 / SC#2)

### Q: Apply or defer?
| Option | Selected |
|--------|----------|
| Apply via ALTER FUNCTION migration | ✓ |
| Record available-but-deferred | |

### Q: Scan mode + cost bound
| Option | Selected |
|--------|----------|
| relaxed_order + scan-tuple bound | ✓ |
| strict_order | |
| Leave tuning to research | |

**User's choice:** Apply via ALTER FUNCTION migration; relaxed_order + max_scan_tuples bound.
**Notes:** Gated behind operator prod validation (recall + latency) because it changes live feed results. Complementary to tiered radius (recall vs scan-size).

## Claude's Discretion

- Exact tier fractions, stop-pool constant, per-restaurant K, and iterative_scan tuning values — sensible starting values, left tunable.
- "Measurably reduced" verification via row-count/byte before-after (no prod required).

## Deferred Ideas

- PERF-V2-01 geo-aware ANN rebuild; PERF-V2-02 full SQL ranking pushdown; targeted-purge cache redesign.
