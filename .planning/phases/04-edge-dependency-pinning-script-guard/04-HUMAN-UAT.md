---
status: partial
phase: 04-edge-dependency-pinning-script-guard
source: [04-VERIFICATION.md]
started: 2026-06-20T05:40:05Z
updated: 2026-06-20T05:40:05Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Operator edge-function smoke-test on live deploy
expected: Deploy the 8 migrated edge functions from `infra/supabase/` and make one real call to each (feed, enrich-dish, invalidate-cache, app-config, group-recommendations, batch-update-preference-vectors, update-preference-vector, menu-scan-worker). Each function cold-starts without a module-resolution error and returns a valid response; the pinned `https://esm.sh/@supabase/supabase-js@2.39.3` and `https://esm.sh/@upstash/redis@1.38.0` specifiers resolve correctly from the live Supabase edge runtime. For feed/enrich-dish/invalidate-cache, confirm CORS headers still behave (allowlisted browser origin reflected, no-Origin native call succeeds).
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
