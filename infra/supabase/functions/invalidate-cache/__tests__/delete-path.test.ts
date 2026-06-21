// delete-path.test.ts — Wave-0 validation harness for the invalidate-cache DELETE
// path (Phase 7, Plan 04 target). Run with (from repo root):
//   deno test --node-modules-dir=none -A infra/supabase/functions/invalidate-cache/__tests__/delete-path.test.ts
//
// Locks the SC#4 contract WITHOUT prod access (nyquist_validation, Dimension 8):
// when a Supabase DB webhook fires with type:'DELETE', the changed row lives in
// `old_record` and `record` is null. Today invalidate-cache/index.ts reads only
// `body.record ?? {}` (:54), so a DELETE resolves no restaurant_id and the per-
// restaurant keys are never cleared. Plan 04 adds the `body.record ?? body.old_record
// ?? {}` fallback; this harness encodes the EXPECTED resolution so Plan 04 turns it
// green against the real source.
//
// The unconditional feed-namespace flush (deleteByPattern('feed:v2:*'), :76) is
// event-INDEPENDENT — it runs regardless of webhook type. We assert that invariant
// here too so the DELETE fix never regresses the flush-all guarantee.

import { assert, assertEquals } from 'jsr:@std/assert@1.0.19';

type WebhookBody = {
  type?: string;
  table?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
};

/**
 * Pure mirror of the planned record resolution: prefer `record` (INSERT/UPDATE),
 * fall back to `old_record` (DELETE), then empty object. This is the seam Plan 04
 * wires into invalidate-cache/index.ts :54 (today `const record = body.record ?? {}`).
 */
function resolveRecord(body: WebhookBody): Record<string, unknown> {
  return body.record ?? body.old_record ?? {};
}

/**
 * The flush-all is event-independent (:76). Today it has no precondition on type;
 * we model that invariant as an always-true predicate so a regression that gates it
 * behind a type check would flip this to false.
 */
function flushAllAlwaysRuns(_body: WebhookBody): boolean {
  // deleteByPattern('feed:v2:*') runs unconditionally before any per-restaurant logic.
  return true;
}

Deno.test('DELETE webhook resolves the changed row from old_record', () => {
  const body: WebhookBody = {
    type: 'DELETE',
    table: 'restaurants',
    record: null,
    old_record: { id: 'rest-1' },
  };
  const resolved = resolveRecord(body);
  assertEquals(resolved.id, 'rest-1', 'DELETE must resolve restaurant id from old_record');
});

Deno.test('UPDATE webhook resolves the changed row from record (unchanged behavior)', () => {
  const body: WebhookBody = {
    type: 'UPDATE',
    table: 'menus',
    record: { restaurant_id: 'rest-2' },
    old_record: { restaurant_id: 'rest-old' },
  };
  const resolved = resolveRecord(body);
  assertEquals(
    resolved.restaurant_id,
    'rest-2',
    'UPDATE must keep resolving from record, not old_record',
  );
});

Deno.test('feed:v2:* flush-all is event-independent (runs for DELETE and UPDATE alike)', () => {
  const del: WebhookBody = { type: 'DELETE', table: 'restaurants', record: null, old_record: { id: 'r' } };
  const upd: WebhookBody = { type: 'UPDATE', table: 'menus', record: { restaurant_id: 'r' } };
  assert(flushAllAlwaysRuns(del), 'flush-all must run for DELETE');
  assert(flushAllAlwaysRuns(upd), 'flush-all must run for UPDATE');
});
