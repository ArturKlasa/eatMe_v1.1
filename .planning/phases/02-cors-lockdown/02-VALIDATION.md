---
phase: 2
slug: cors-lockdown
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Deno built-in test runner (`deno test`) — FIRST true Deno test in the repo (existing `tests/migrations/*.test.ts` are Vitest, not Deno) |
| **Config file** | none — no `deno.json`; `deno test` runs without config |
| **Quick run command** | `~/.deno/bin/deno test --node-modules-dir=none -A infra/supabase/functions/_shared/cors.test.ts` |
| **Full suite command** | same (single new test file) |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `~/.deno/bin/deno test --node-modules-dir=none -A infra/supabase/functions/_shared/cors.test.ts`
- **After every plan wave:** Run the same (single file)
- **Before `/gsd-verify-work`:** Deno test must be green locally
- **Max feedback latency:** ~5 seconds

> Operator smoke calls (SC#1/SC#2/SC#3 against deployed prod functions) are **stage-don't-apply** — they are an operator checklist on deploy, NOT an agent gate. The agent loop's gate is the local Deno test passing.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | SEC-01 (SC#1) | V14.5 CORS | allowed origin → ACAO reflects origin (no `*`), `Vary: Origin` present, verbatim allow-headers | unit | `deno test … _shared/cors.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | SEC-01 (SC#1) | Info Disclosure | disallowed/empty origin → no `*`, no ACAO, `Vary` still present | unit | same | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | SEC-01 (SC#2) | — | no-`Origin` request (mobile/curl) → no ACAO, helper returns would-200 header set | unit | same | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | SEC-01 (D-10 fail-closed) | Info Disclosure (fail-open) | `ALLOWED_ORIGINS` unset → no ACAO even for would-be-allowed origin (NOT `*`) | unit | same | ❌ W0 | ⬜ pending |
| 2-02-* | 02 | 2 | SEC-01 (SC#3) | Cache poison / drift | OPTIONS preflight + main response route through one helper → identical CORS set; `corsHeaders` is per-request; no stray module-level const remains | grep + `deno check` / `pnpm check-types` | `grep -L "const corsHeaders = {" feed enrich-dish invalidate-cache` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `infra/supabase/functions/_shared/cors.ts` — the `buildCorsHeaders(origin)` helper under test (covers SEC-01)
- [ ] `infra/supabase/functions/_shared/cors.test.ts` — the four-case Deno test (allowed / disallowed / no-Origin / unset-env)
- [ ] No framework install needed — `deno test` is built-in; `jsr:@std/assert` auto-resolves on demand

*This is the repo's first Deno test file; no shared Deno fixtures/conftest needed — the helper is pure and self-contained.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#1 prod no-wildcard | SEC-01 | Requires deployed prod function | `curl -i` with a disallowed/absent `Origin` → response has NO `Access-Control-Allow-Origin: *` |
| SC#2 no-Origin succeeds | SEC-01 | Requires deployed prod function | `curl` with NO `Origin` header (simulates mobile) → still 200 / normal body |
| SC#3 preflight matches | SEC-01 | Requires deployed prod function + browser-origin | `curl -i -X OPTIONS -H 'Origin: https://eat-me-v1-1-admin.vercel.app'` → ACAO echoes the admin origin, `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` present, `Vary: Origin` present |
| `ALLOWED_ORIGINS` secret set | SEC-01 (D-01/D-10) | Operator-owned prod config (stage-don't-apply) | Operator sets the secret BEFORE the SC#3 smoke call, value `https://eat-me-v1-1-admin.vercel.app,http://localhost:3001` — else SC#3 falsely appears broken (fail-closed by design) |

*These mirror the 3 success criteria exactly and are handed to the operator as a deploy checklist (stage-don't-apply).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`cors.ts` + `cors.test.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
