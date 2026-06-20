// infra/scripts/lib/prod-guard.ts
//
// The single DRY source of prod-write clearance for every `infra/scripts`
// ts-node script that mutates LIVE prod Supabase with the service-role key
// (SEC-03 / F-12). This is the `infra/scripts` analog of the Phase 2
// `_shared/cors.ts` shared-helper precedent (D-07) — write-path scripts import
// and call it instead of re-implementing the dry-run / --apply / announce-ref
// logic inline.
//
// Safety contract (D-09 / D-10 / D-11 / D-12):
//   - DEFAULT DRY-RUN. Absent `--apply`, `dryRun` is true and no mutation is
//     reached. This intentionally inverts the legacy LIVE-default backfills.
//   - `--apply` is the SOLE write trigger — the only way to set dryRun=false.
//   - `--dry-run` is an accepted no-op that re-affirms the default and NEVER
//     throws (operator muscle-memory / existing docs keep working).
//   - `--limit=N` sampling is parsed and RETURNED (not stripped), so the
//     dry-run → sample → full workflow is preserved (limit 0 = all).
//   - announceTarget() prints the resolved project ref (from the SUPABASE_URL
//     host) before any write, on every run, so the operator can abort if the
//     .env is pointed at the wrong project.
//
// The guard is pure and dependency-free: callers run `import 'dotenv/config'`
// before invoking it; the guard only reads `process.env.SUPABASE_URL`. There is
// no dedicated project-ref env anywhere — the ref is always derived from the URL.
// Generalizes the inline form in apply-phase6-flag-fixes.ts:452-455.

export interface GuardResult {
  /** True unless --apply is present. No mutation may run while this is true. */
  dryRun: boolean;
  /** The sole write trigger: argv.includes('--apply'). */
  apply: boolean;
  /** Project ref parsed from the SUPABASE_URL host, or '(unknown)'. */
  projectRef: string;
  /** Parsed from --limit=N; 0 means "all". Returned, never consumed. */
  limit: number;
}

/**
 * Derive the Supabase project ref from the SUPABASE_URL host.
 * `https://abcdefgh.supabase.co` → `abcdefgh`. Never throws — on an
 * empty/unparseable URL it returns the sentinel `'(unknown)'` (env validation
 * is the caller's responsibility, not the guard's).
 */
function deriveProjectRef(supabaseUrl: string | undefined): string {
  if (!supabaseUrl) return '(unknown)';
  try {
    const host = new URL(supabaseUrl).hostname; // e.g. abcdefgh.supabase.co
    const ref = host.split('.')[0];
    return ref && ref.length > 0 ? ref : '(unknown)';
  } catch {
    return '(unknown)';
  }
}

/**
 * Parse the prod-write clearance flags from argv.
 *
 * - `apply`      = argv.includes('--apply')
 * - `dryRun`     = !apply  (default dry-run; --dry-run does not change this — it
 *                 is an accepted no-op affirmation, never an error)
 * - `projectRef` = derived from process.env.SUPABASE_URL host (sentinel on miss)
 * - `limit`      = parsed from --limit=N (0 = all); returned, not stripped
 */
export function parseGuard(argv: string[] = process.argv): GuardResult {
  const apply = argv.includes('--apply');
  const dryRun = !apply;

  const limitArg = argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '0', 10) || 0 : 0;

  const projectRef = deriveProjectRef(process.env.SUPABASE_URL);

  return { dryRun, apply, projectRef, limit };
}

/**
 * Print a loud banner BEFORE any write, on every run (D-11). Makes the
 * LIVE-default inversion impossible to miss: the dry-run path states the new
 * default and how to write; the apply path warns it is mutating the named
 * project. Generalizes apply-phase6-flag-fixes.ts:454-456.
 */
export function announceTarget(g: { dryRun: boolean; projectRef: string }): void {
  if (g.dryRun) {
    console.log(
      `\n=== DRY RUN (no writes) — project ${g.projectRef} — re-run with --apply to write ===\n`
    );
  } else {
    console.log(`\n=== ⚠ APPLYING to project ${g.projectRef} — writing to LIVE prod ===\n`);
  }
}
