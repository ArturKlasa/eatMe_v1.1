#!/usr/bin/env ts-node
/**
 * generate-phase6-flag-checklist.ts — READ-ONLY (no writes to the DB).
 *
 * Phase 6 migration 158 collapsed single-child parent dishes to plain dishes and
 * KEPT the parent's menu price, even where the (now-deleted) variant carried a
 * very different price (>25% gap). Those 51 cases were emitted as a comment
 * footer in migrations/158_phase6_data_conversion.sql for an operator spot-check.
 *
 * This script parses that footer (the authoritative record — the variant rows are
 * deleted), matches each flag back to its surviving dish in prod by (name, price)
 * to attach restaurant + dish_id, and writes an operator checklist grouped by
 * restaurant to docs/plans/phase6-price-flag-triage.md.
 *
 * Ambiguous (>1 candidate) and not-found matches are surfaced explicitly.
 *
 * Usage:  cd infra/scripts && pnpm exec ts-node generate-phase6-flag-checklist.ts
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;
const MIG = join(__dirname, '..', 'supabase', 'migrations', '158_phase6_data_conversion.sql');
const OUT = join(__dirname, '..', '..', 'docs', 'plans', 'phase6-price-flag-triage.md');

type Flag = { dish: string; kept: number; variant: string; vprice: number };
type Match = { id: string; restaurant_id: string; price: number | null };

function parseFlags(): Flag[] {
  const re = /^--\s+(.+?): kept \$([\d.]+), variant "(.*)" was \$([\d.]+)\s*$/;
  const flags: Flag[] = [];
  for (const line of readFileSync(MIG, 'utf8').split('\n')) {
    const m = line.match(re);
    if (m) flags.push({ dish: m[1], kept: +m[2], variant: m[3], vprice: +m[4] });
  }
  return flags;
}

const eqPrice = (a: number | null, b: number) => a != null && Math.abs(a - b) < 0.005;
const pct = (kept: number, v: number) =>
  kept === 0 ? Infinity : Math.round(((v - kept) / kept) * 100);

async function main() {
  const flags = parseFlags();
  console.log(
    `\n=== Phase 6 flag checklist — ${flags.length} flags parsed from migration footer ===\n`
  );

  // Pull every surviving dish whose name matches a flagged dish (collapsed → is_parent=false).
  const names = Array.from(new Set(flags.map(f => f.dish)));
  const byName = new Map<string, Match[]>();
  for (let i = 0; i < names.length; i += 80) {
    const { data } = await sb
      .from('dishes')
      .select('id,name,price,restaurant_id')
      .in('name', names.slice(i, i + 80));
    for (const d of data ?? []) {
      const k = d.name.toLowerCase();
      const a = byName.get(k) ?? [];
      a.push({ id: d.id, restaurant_id: d.restaurant_id, price: d.price });
      byName.set(k, a);
    }
  }

  // Resolve each flag → exactly one dish where possible (match on name, then price).
  type Row = Flag & {
    status: 'ok' | 'ambiguous' | 'notfound';
    id?: string;
    restaurant_id?: string;
  };
  const rows: Row[] = flags.map(f => {
    const cands = (byName.get(f.dish.toLowerCase()) ?? []).filter(c => eqPrice(c.price, f.kept));
    if (cands.length === 1)
      return { ...f, status: 'ok', id: cands[0].id, restaurant_id: cands[0].restaurant_id };
    if (cands.length > 1)
      return { ...f, status: 'ambiguous', restaurant_id: cands[0].restaurant_id };
    return { ...f, status: 'notfound' };
  });

  // Restaurant names for the matched rows.
  const restIds = Array.from(new Set(rows.map(r => r.restaurant_id).filter(Boolean))) as string[];
  const rname = new Map<string, string>();
  for (let i = 0; i < restIds.length; i += 80) {
    const { data } = await sb
      .from('restaurants')
      .select('id,name')
      .in('id', restIds.slice(i, i + 80));
    for (const r of data ?? []) rname.set(r.id, r.name);
  }

  // Group by restaurant (unmatched → its own bucket).
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key =
      r.status === 'notfound'
        ? '⚠ Needs manual lookup (no price match)'
        : (rname.get(r.restaurant_id!) ?? r.restaurant_id ?? '—');
    const a = groups.get(key) ?? [];
    a.push(r);
    groups.set(key, a);
  }
  const sortedGroups = Array.from(groups.entries()).sort((a, b) =>
    a[0].startsWith('⚠') ? 1 : b[0].startsWith('⚠') ? -1 : a[0].localeCompare(b[0])
  );

  const okCount = rows.filter(r => r.status === 'ok').length;
  const ambCount = rows.filter(r => r.status === 'ambiguous').length;
  const nfCount = rows.filter(r => r.status === 'notfound').length;

  // ── Render markdown ─────────────────────────────────────────────────────────
  const md: string[] = [];
  md.push('# Phase 6 — price-discrepancy triage checklist');
  md.push('');
  md.push(
    `> Generated read-only by \`infra/scripts/generate-phase6-flag-checklist.ts\` from the migration 158 footer + live prod.`
  );
  md.push('');
  md.push('## What this is');
  md.push('');
  md.push(
    'Migration 158 collapsed single-child parent dishes into plain dishes and **kept the parent’s menu price**. ' +
      'In these 51 cases the (now-deleted) size/variant row carried a price >25% different from what was kept. ' +
      'For each, open the dish in the portal and decide:'
  );
  md.push('');
  md.push(
    '1. **Dropped a real second size/portion** (e.g. *Grande*, *Corte grueso*, *100 gr.*, *Orden de tres*) — the dominant case. Collapsing kept one size and discarded the other. If the restaurant still sells both, **re-add the dropped size as an option** (not just edit the single price).'
  );
  md.push('2. **Kept price is simply wrong** — fix it in place.');
  md.push(
    '3. **Negative Δ = add-on delta** (e.g. "+ pechuga de pollo") that was never a standalone price — usually the kept price is already correct; no action.'
  );
  md.push('');
  md.push(
    `**${flags.length} flags** — ${okCount} matched to a dish, ${ambCount} ambiguous (multiple dishes, same name+price), ${nfCount} not found (price already changed since the migration).`
  );
  md.push('');
  md.push('Columns: **Δ** = variant vs. kept price. Tick **Done** as you clear each.');
  md.push('');

  for (const [restaurant, list] of sortedGroups) {
    md.push(`### ${restaurant}`);
    md.push('');
    md.push('| Done | Dish | Kept price | Dropped variant | Variant price | Δ | Dish ID |');
    md.push('|:--:|---|--:|---|--:|--:|---|');
    for (const r of list.sort((a, b) => a.dish.localeCompare(b.dish))) {
      const d = pct(r.kept, r.vprice);
      const dStr = d === Infinity ? '—' : `${d > 0 ? '+' : ''}${d}%`;
      const idCell =
        r.status === 'ok'
          ? `\`${r.id}\``
          : r.status === 'ambiguous'
            ? '⚠ ambiguous'
            : '⚠ not found';
      md.push(
        `| [ ] | ${r.dish} | $${r.kept} | ${r.variant} | $${r.vprice} | ${dStr} | ${idCell} |`
      );
    }
    md.push('');
  }
  writeFileSync(OUT, md.join('\n'));

  console.log(`matched ${okCount} · ambiguous ${ambCount} · not found ${nfCount}`);
  console.log(`grouped into ${sortedGroups.length} restaurants`);
  console.log(`\n✓ wrote ${OUT}\n(read-only — nothing written to the database)\n`);
}
main().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
