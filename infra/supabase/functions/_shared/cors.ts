// infra/supabase/functions/_shared/cors.ts
//
// The single DRY source of CORS headers for the SEC-01 edge functions
// (feed, enrich-dish, invalidate-cache). buildCorsHeaders(origin) reads the
// runtime ALLOWED_ORIGINS env var (D-01), reflects an EXACT-matched admin
// origin into Access-Control-Allow-Origin (D-03/D-08), and omits ACAO entirely
// for a no-Origin (D-09), disallowed (D-08), or unset-env (D-10 fail-closed)
// request — it NEVER emits a wildcard origin. Vary: Origin (D-11) and explicit
// Allow-Methods (D-12) are always present alongside the verbatim allow-headers.
//
// The Allow-Credentials response header is deliberately omitted: admin auth is a
// bearer JWT in the `authorization` header, not cookies. Emitting it alongside
// a reflected origin would be a token-theft vector.
//
// NOTE: this module is bundled into each importing function at
// `supabase functions deploy`. Editing it requires redeploying every importer.

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type'; // verbatim, D-12 / SC#3
const ALLOW_METHODS = 'POST, GET, OPTIONS'; // D-12 (GET harmless/future-proof, A3)

export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowlist = (Deno.env.get('ALLOWED_ORIGINS') ?? '') // unset => '' => [] (fail-closed, D-10)
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': ALLOW_METHODS,
    Vary: 'Origin', // ALWAYS present, D-11
  };

  // Exact-string match (D-03 — no regex, no wildcard, no subdomain logic).
  // origin === null (mobile/curl) never matches => no ACAO (D-09).
  // Disallowed browser origin => no ACAO (D-08).
  // Empty allowlist (unset env) => no ACAO (D-10 fail-closed) — never a wildcard.
  if (origin && allowlist.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}
