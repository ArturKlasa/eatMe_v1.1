// cors.test.ts — Deno unit test for the shared buildCorsHeaders CORS helper.
// Run with (from repo root):
//   deno test --node-modules-dir=none -A infra/supabase/functions/_shared/cors.test.ts
//
// Proves the SEC-01 contract at the unit level: exact-allowlist reflection (D-03/D-08),
// fail-closed on disallowed/no-Origin/unset-env (D-08/D-09/D-10 — never a wildcard),
// and Vary: Origin always present (D-11). Each case toggles ALLOWED_ORIGINS via
// Deno.env.set/delete and cleans up in finally so process-global env never leaks
// across cases (Pitfall 3).

import {
  assert,
  assertEquals,
  assertFalse,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { buildCorsHeaders } from './cors.ts';

const ALLOWED = 'https://eat-me-v1-1-admin.vercel.app'; // D-02 deployed admin origin

Deno.test('allowed origin reflects origin + Vary present', () => {
  Deno.env.set('ALLOWED_ORIGINS', `${ALLOWED},http://localhost:3001`);
  try {
    const h = buildCorsHeaders(ALLOWED);
    assertEquals(h['Access-Control-Allow-Origin'], ALLOWED);
    assertEquals(h['Vary'], 'Origin');
    assert(h['Access-Control-Allow-Methods'].includes('POST'));
    assertEquals(
      h['Access-Control-Allow-Headers'],
      'authorization, x-client-info, apikey, content-type'
    );
  } finally {
    Deno.env.delete('ALLOWED_ORIGINS');
  }
});

Deno.test('disallowed origin omits ACAO, Vary still present', () => {
  Deno.env.set('ALLOWED_ORIGINS', ALLOWED);
  try {
    const h = buildCorsHeaders('https://evil.example.com');
    assertFalse('Access-Control-Allow-Origin' in h);
    assertEquals(h['Vary'], 'Origin');
  } finally {
    Deno.env.delete('ALLOWED_ORIGINS');
  }
});

Deno.test('no-Origin (mobile/curl) omits ACAO', () => {
  Deno.env.set('ALLOWED_ORIGINS', ALLOWED);
  try {
    const h = buildCorsHeaders(null);
    assertFalse('Access-Control-Allow-Origin' in h);
  } finally {
    Deno.env.delete('ALLOWED_ORIGINS');
  }
});

Deno.test('ALLOWED_ORIGINS unset is fail-closed (no ACAO, NOT wildcard)', () => {
  Deno.env.delete('ALLOWED_ORIGINS'); // precondition: unset
  try {
    const h = buildCorsHeaders(ALLOWED); // the would-be-allowed origin
    assertFalse('Access-Control-Allow-Origin' in h); // fail-closed, NOT a wildcard
    assertEquals(h['Vary'], 'Origin'); // still well-formed
  } finally {
    Deno.env.delete('ALLOWED_ORIGINS');
  }
});
