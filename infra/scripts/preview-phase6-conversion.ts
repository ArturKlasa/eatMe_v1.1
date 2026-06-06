#!/usr/bin/env ts-node
/**
 * preview-phase6-conversion.ts — READ-ONLY against prod (no writes).
 *
 * Reads live prod, computes the validated Phase 6 conversion, prints an audit,
 * AND emits a literal, atomic migration SQL to:
 *     infra/supabase/dry-runs/158_phase6_data_conversion.generated.sql
 *
 * The emitted SQL has every value precomputed (no PL/pgSQL parsing), wrapped in
 * BEGIN…ROLLBACK (flip to COMMIT to apply). Review it, dry-run it on a replica,
 * then promote to migrations/158_*.sql.
 *
 * Validated logic (read-only, 2026-06-05 — see docs/plans/dish-model-rewrite-phase-6-data-migration.md):
 *   - re-tag standard+is_parent (6 seafood) + bundle (3) → configurable
 *   - multi (>=2 kids) → option_group + options.
 *       base = MIN(child) when min>0 (absolute prices) else parent.price (deltas).
 *       option delta = child-base (abs) | child (delta). is_default = cheapest.
 *       primary_protein override only when it differs from parent.
 *   - single/childless → collapse to standard. price = parent.price>0 ? parent : child.
 *       descriptor → portion_amount/unit where parseable, else discarded.
 *   - delete folded children; converted parents → is_parent=false, enrichment_status='none'.
 *   - FLAG (operator spot-check, NOT auto-resolved): 51 single-child parent/child price
 *     discrepancies >25% — emitted as a comment block in the SQL.
 *
 * Usage:  cd infra/scripts && pnpm exec ts-node preview-phase6-conversion.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL / SERVICE_ROLE in infra/scripts/.env');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_ROLE) as any;
const OUT = join(
  __dirname,
  '..',
  'supabase',
  'dry-runs',
  '158_phase6_data_conversion.generated.sql'
);

const ES = new Set([
  'ES',
  'MX',
  'AR',
  'CL',
  'CO',
  'PE',
  'VE',
  'CR',
  'EC',
  'GT',
  'HN',
  'NI',
  'PA',
  'PY',
  'SV',
  'UY',
  'DO',
  'CU',
  'BO',
]);
const gname = (c: string | null) =>
  ES.has((c ?? '').toUpperCase())
    ? 'Elige una opción'
    : (c ?? '').toUpperCase() === 'PL'
      ? 'Wybierz opcję'
      : 'Choose an option';
const esc = (s: string) => s.replace(/'/g, "''");

type Unit = 'g' | 'ml' | 'pcs' | 'oz';
function parsePortion(raw: string): { amount: number; unit: Unit } | null {
  const s = raw.toLowerCase().trim();
  const words: Record<string, number> = {
    un: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
  };
  const o = s.match(/orden de (\w+)/);
  if (o && words[o[1]]) return { amount: words[o[1]], unit: 'pcs' };
  const m = s.match(
    /^(\d+(?:[.,]\d+)?)\s*(kg|grs|gr|gramos|gramo|g|ml|litros|litro|lt|l|oz|onzas|onza|piezas|pieza|pzs|pza|pz|unidades|unidad|uds|ud|pcs)\b/
  );
  if (!m) return null;
  const a = parseFloat(m[1].replace(',', '.'));
  const u = m[2];
  if (u === 'kg') return { amount: Math.round(a * 1000), unit: 'g' };
  if (/^(g|gr|grs|gramo|gramos)$/.test(u)) return { amount: Math.round(a), unit: 'g' };
  if (u === 'ml') return { amount: Math.round(a), unit: 'ml' };
  if (/^(l|lt|litro|litros)$/.test(u)) return { amount: Math.round(a * 1000), unit: 'ml' };
  if (/^(oz|onza|onzas)$/.test(u)) return { amount: Math.round(a), unit: 'oz' };
  return { amount: Math.round(a), unit: 'pcs' };
}

type Dish = {
  id: string;
  name: string;
  price: number | null;
  dish_kind: string;
  primary_protein: string | null;
  parent_dish_id: string | null;
  is_parent: boolean;
  restaurant_id: string;
};
async function headCount(t: string): Promise<number> {
  const { count } = await sb.from(t).select('id', { count: 'exact', head: true });
  return count ?? 0;
}

async function main() {
  console.log(
    `\n=== Phase 6 conversion — read-only preview + SQL generation — ${SUPABASE_URL} ===\n`
  );
  const sel = 'id,name,price,dish_kind,primary_protein,parent_dish_id,is_parent,restaurant_id';
  const { data: parents } = await sb.from('dishes').select(sel).eq('is_parent', true);
  const { data: children } = await sb.from('dishes').select(sel).not('parent_dish_id', 'is', null);
  const restIds = Array.from(new Set((parents as Dish[]).map(p => p.restaurant_id)));
  const { data: rests } = await sb.from('restaurants').select('id,country_code').in('id', restIds);
  const country = new Map<string, string | null>(
    (rests ?? []).map((r: any) => [r.id, r.country_code ?? null])
  );

  const kidsOf = new Map<string, Dish[]>();
  for (const c of children as Dish[]) {
    const a = kidsOf.get(c.parent_dish_id!) ?? [];
    a.push(c);
    kidsOf.set(c.parent_dish_id!, a);
  }
  const n = (p: Dish) => kidsOf.get(p.id)?.length ?? 0;
  const cfg = (parents as Dish[]).filter(p =>
    ['configurable', 'standard', 'bundle'].includes(p.dish_kind)
  );
  const multi = cfg.filter(p => n(p) >= 2),
    single = cfg.filter(p => n(p) === 1),
    childless = cfg.filter(p => n(p) === 0);

  const sql: string[] = [];
  sql.push(
    '-- 158_phase6_data_conversion — GENERATED (read-only) from prod by infra/scripts/preview-phase6-conversion.ts'
  );
  sql.push('-- Plan: docs/plans/dish-model-rewrite-phase-6-data-migration.md');
  sql.push(
    '-- DRY-RUN: ends in ROLLBACK. Review + replica-test, then change ROLLBACK→COMMIT and move to migrations/.'
  );
  sql.push('BEGIN;\n');

  // MULTI → groups
  let totalOptions = 0;
  const flags: string[] = [];
  const childIds: string[] = [];
  sql.push(`-- ===== MULTI → option groups (${multi.length} dishes) =====`);
  for (const p of multi) {
    const kids = kidsOf
      .get(p.id)!
      .slice()
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    const minK = Math.min(...kids.map(k => k.price ?? 0));
    const abs = minK > 0;
    const base = abs ? minK : (p.price ?? 0);
    const gid = randomUUID();
    childIds.push(...kids.map(k => k.id));
    sql.push(`-- ${esc(p.name)}  (base $${base}${abs ? '' : ' [delta-mode]'})`);
    sql.push(
      `INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('${gid}','${p.restaurant_id}','${p.id}','${esc(gname(country.get(p.restaurant_id) ?? null))}','single',1,1,0,true,false);`
    );
    const opts = kids.map((k, i) => {
      const delta = (k.price ?? 0) - (abs ? base : 0);
      const prot =
        k.primary_protein && k.primary_protein !== p.primary_protein
          ? `'${esc(k.primary_protein)}'`
          : 'NULL';
      totalOptions++;
      return `  (gen_random_uuid(),'${gid}','${esc(k.name)}',${delta},${prot},${i === 0},${i},true)`;
    });
    sql.push(
      `INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES\n${opts.join(',\n')};`
    );
    sql.push(
      `UPDATE dishes SET price=${base},display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='${p.id}';\n`
    );
  }

  // COLLAPSE single + childless
  let parsed = 0;
  sql.push(
    `\n-- ===== COLLAPSE single/childless → standard (${single.length + childless.length} dishes) =====`
  );
  for (const p of [...single, ...childless]) {
    const kid = (kidsOf.get(p.id) ?? [])[0];
    const price = p.price && p.price > 0 ? p.price : kid ? kid.price : p.price;
    if (kid) childIds.push(kid.id);
    let portionSet = ', portion_amount=NULL, portion_unit=NULL';
    if (kid) {
      const port = parsePortion(kid.name);
      if (port) {
        parsed++;
        portionSet = `, portion_amount=${port.amount}, portion_unit='${port.unit}'`;
      }
      if (p.price && p.price > 0 && kid.price && Math.abs(kid.price - p.price) / p.price > 0.25)
        flags.push(`${p.name}: kept $${p.price}, variant "${kid.name}" was $${kid.price}`);
    }
    const note = kid ? `  -- "${esc(kid.name)}"` : '  -- childless';
    sql.push(
      `UPDATE dishes SET price=${price ?? 'NULL'}, is_parent=false, enrichment_status='none'${portionSet} WHERE id='${p.id}';${note}`
    );
  }

  // DELETE children
  sql.push(`\n-- ===== DELETE folded children (${childIds.length}) =====`);
  for (let i = 0; i < childIds.length; i += 50)
    sql.push(
      `DELETE FROM dishes WHERE id IN (${childIds
        .slice(i, i + 50)
        .map(id => `'${id}'`)
        .join(',')});`
    );

  // AUDIT + flag list
  sql.push(`\n-- ===== AUDIT =====`);
  sql.push(
    `SELECT 'option_groups' AS t, count(*) FROM option_groups UNION ALL SELECT 'options', count(*) FROM options UNION ALL SELECT 'dishes', count(*) FROM dishes UNION ALL SELECT 'still_parent', count(*) FROM dishes WHERE is_parent;`
  );
  sql.push(
    `\n-- ===== OPERATOR FLAG LIST — ${flags.length} single-child price discrepancies (>25%); kept the menu price =====`
  );
  for (const f of flags) sql.push(`--   ${f}`);
  sql.push('\nROLLBACK;\n-- COMMIT;');
  writeFileSync(OUT, sql.join('\n'));

  // Console audit
  console.log(
    `multi ${multi.length} → ${totalOptions} options · collapse ${single.length + childless.length} (${parsed} portions) · children deleted ${childIds.length}`
  );
  const [d, og, o] = await Promise.all([
    headCount('dishes'),
    headCount('option_groups'),
    headCount('options'),
  ]);
  console.log(
    `projected: dishes ${d}→${d - childIds.length} · option_groups ${og}→${og + multi.length} · options ${o}→${o + totalOptions}`
  );
  console.log(`operator flag list: ${flags.length} price discrepancies (in the SQL footer)`);
  console.log(`\n✓ wrote ${OUT}\n(read-only — nothing written to the database)\n`);
}
main().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
