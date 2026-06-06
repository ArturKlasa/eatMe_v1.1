#!/usr/bin/env ts-node
/**
 * verify-phase6.ts — READ-ONLY. Confirms whether migration 158 is live in prod
 * and spot-checks the converted data. No writes.
 *
 * Usage:  cd infra/scripts && pnpm exec ts-node verify-phase6.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

async function count(t: string, f?: (q: any) => any): Promise<number> {
  let q = sb.from(t).select('id', { count: 'exact', head: true });
  if (f) q = f(q);
  const { count } = await q;
  return count ?? 0;
}

async function main() {
  console.log(`\n=== Phase 6 verification (read-only) — ${process.env.SUPABASE_URL} ===\n`);

  const stillParent = await count('dishes', q => q.eq('is_parent', true));
  const stillChildren = await count('dishes', q => q.not('parent_dish_id', 'is', null));
  const dishes = await count('dishes');
  const groups = await count('option_groups');
  const options = await count('options');

  console.log(
    `is_parent=true remaining : ${stillParent}   (0 = migration COMMITTED · 135 = rolled back / not applied)`
  );
  console.log(`variant children remaining: ${stillChildren}   (expect 0)`);
  console.log(`dishes ${dishes} · option_groups ${groups} · options ${options}\n`);

  const committed = stillParent === 0 && stillChildren === 0;
  console.log(
    committed
      ? '→ Migration 158 IS LIVE in prod.\n'
      : '→ NOT applied (dry-run rolled back, or different DB).\n'
  );
  if (!committed) return;

  // Spot-check a multi (seafood Calamar) and a portion collapse (Jamón)
  const { data: cal } = await sb
    .from('dishes')
    .select(
      'name,price,display_price_prefix,is_parent,option_groups(name,options(name,price_delta,is_default))'
    )
    .ilike('name', 'Calamar')
    .is('parent_dish_id', null)
    .limit(1);
  if (cal?.[0]) {
    const d = cal[0];
    const g = (d.option_groups ?? [])[0];
    console.log(
      `Calamar: $${d.price} ${d.display_price_prefix} · is_parent=${d.is_parent} · group "${g?.name}" with ${(g?.options ?? []).length} options`
    );
    for (const o of g?.options ?? [])
      console.log(`   - ${o.name}  +${o.price_delta}${o.is_default ? '  (default)' : ''}`);
  }
  const { data: jam } = await sb
    .from('dishes')
    .select('name,price,portion_amount,portion_unit,is_parent')
    .ilike('name', 'Jamón ibérico%')
    .limit(2);
  for (const d of jam ?? [])
    console.log(
      `${d.name}: $${d.price} · portion ${d.portion_amount ?? '—'}${d.portion_unit ?? ''} · is_parent=${d.is_parent}`
    );

  // Re-embed queue (conversion set enrichment_status='none')
  const pending = await count('dishes', q => q.in('enrichment_status', ['none', 'failed']));
  console.log(`\nenrichment_status none/failed (re-embed queue for batch-embed.ts): ${pending}`);
  console.log('\n(read-only — nothing written)\n');
}
main().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
