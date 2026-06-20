// infra/scripts/lib/prod-guard.test.ts
//
// node --test coverage of the prod-guard safety invariants (SEC-03). The guard's
// failure mode is "silently writes to prod" — the exact SEC-03 risk — so the one
// piece of net-new safety logic gets a pure-function unit test that a future edit
// cannot quietly invert. Runs via `npm run test:guard` (node --test + ts-node);
// no network, no prod Supabase — every call uses an explicit argv array and a
// locally set/restored process.env.SUPABASE_URL.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseGuard } from './prod-guard';

test('no flag → default dry-run (D-09)', () => {
  const g = parseGuard(['node', 'script.ts']);
  assert.equal(g.dryRun, true);
  assert.equal(g.apply, false);
});

test('--apply → write enabled; --apply is the sole write trigger (D-10)', () => {
  const g = parseGuard(['node', 'script.ts', '--apply']);
  assert.equal(g.dryRun, false);
  assert.equal(g.apply, true);
});

test('--dry-run → dry-run, accepted no-op, never throws (D-10)', () => {
  let g: ReturnType<typeof parseGuard>;
  assert.doesNotThrow(() => {
    g = parseGuard(['node', 'script.ts', '--dry-run']);
  });
  assert.equal(g!.dryRun, true);
  assert.equal(g!.apply, false);
});

test('--apply --dry-run → --apply wins; --dry-run is a no-op affirmation (D-10)', () => {
  const g = parseGuard(['node', 'script.ts', '--apply', '--dry-run']);
  assert.equal(g.dryRun, false);
  assert.equal(g.apply, true);
});

test('--limit=5 → limit returned, sampling preserved (D-12)', () => {
  const g = parseGuard(['node', 'script.ts', '--limit=5']);
  assert.equal(g.limit, 5);
  // limit is orthogonal to dry-run/apply
  assert.equal(g.dryRun, true);
});

test('no --limit → limit 0 (= all)', () => {
  const g = parseGuard(['node', 'script.ts']);
  assert.equal(g.limit, 0);
});

test('projectRef derived from SUPABASE_URL host (no dedicated ref env)', () => {
  const prev = process.env.SUPABASE_URL;
  try {
    process.env.SUPABASE_URL = 'https://abcdefgh.supabase.co';
    const g = parseGuard(['node', 'script.ts']);
    assert.equal(g.projectRef, 'abcdefgh');
  } finally {
    if (prev === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prev;
  }
});

test('empty SUPABASE_URL → non-throwing sentinel, never throws', () => {
  const prev = process.env.SUPABASE_URL;
  try {
    process.env.SUPABASE_URL = '';
    let g: ReturnType<typeof parseGuard>;
    assert.doesNotThrow(() => {
      g = parseGuard(['node', 'script.ts']);
    });
    assert.equal(g!.projectRef, '(unknown)');
  } finally {
    if (prev === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prev;
  }
});
