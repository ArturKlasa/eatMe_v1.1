#!/usr/bin/env ts-node
/**
 * check-favorites-duplicates.ts — READ-ONLY (no writes).
 *
 * Counts duplicate rows in public.favorites grouped by
 * (user_id, subject_type, subject_id). Run BEFORE applying migration 151 (which
 * adds a UNIQUE constraint and deletes duplicates) to see exactly how many rows
 * the de-dupe DELETE would remove.
 *
 * Hits live prod via infra/scripts/.env service-role creds. No mutations.
 *
 * Usage:
 *   pnpm --filter @eatme/infra-scripts ts-node check-favorites-duplicates.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

type Row = {
  id: string;
  user_id: string;
  subject_type: string;
  subject_id: string;
  created_at: string;
};

async function fetchAll(): Promise<Row[]> {
  const all: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from('favorites')
      .select('id, user_id, subject_type, subject_id, created_at')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('Query failed:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    all.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  return all;
}

(async () => {
  const rows = await fetchAll();

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.user_id}|${r.subject_type}|${r.subject_id}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  let dupGroups = 0;
  let rowsToDelete = 0;
  const samples: string[] = [];
  for (const [key, g] of groups) {
    if (g.length > 1) {
      dupGroups++;
      rowsToDelete += g.length - 1;
      if (samples.length < 10) {
        const [uid, stype, sid] = key.split('|');
        samples.push(
          `  ${stype.padEnd(10)} user=${uid.slice(0, 8)}… subject=${sid.slice(0, 8)}… ×${g.length}`
        );
      }
    }
  }

  const byType: Record<string, number> = {};
  for (const r of rows) byType[r.subject_type] = (byType[r.subject_type] ?? 0) + 1;

  console.log('── favorites duplicate check (READ-ONLY) ──');
  console.log(`total rows:                      ${rows.length}`);
  console.log(`  by subject_type:               ${JSON.stringify(byType)}`);
  console.log(`unique (user,type,subject):      ${groups.size}`);
  console.log(`duplicate groups:                ${dupGroups}`);
  console.log(`rows migration 151 would DELETE: ${rowsToDelete}`);
  if (samples.length) {
    console.log('sample duplicate groups:');
    console.log(samples.join('\n'));
  }
  if (rowsToDelete === 0) {
    console.log('\n✅ No duplicates — the UNIQUE constraint applies cleanly, zero deletions.');
  } else {
    console.log(
      `\n⚠️  ${rowsToDelete} row(s) would be removed by the de-dupe step before the constraint is added.`
    );
  }
})();
