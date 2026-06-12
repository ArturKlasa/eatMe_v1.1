#!/usr/bin/env ts-node
/**
 * apply-phase6-flag-fixes.ts — batch-applies the operator-approved fixes for the
 * 50 remaining Phase 6 price-discrepancy flags (docs/plans/phase6-price-flag-triage.md).
 * Flag 1/51 (Aura ENSALADA CESAR) was applied manually on 2026-06-11.
 *
 * For each flag: keep the dish's menu price, restore the dropped variant as an
 * optional modifier — option_group (single, min 0 / max 1) + one option with
 * price_delta = variant − kept. Negative delta (Catorze vegan row) is valid.
 *
 * Guards per dish: price must still equal the kept price from the checklist, and
 * no option group with the same target name may already exist (idempotent re-runs).
 *
 * Usage:  cd infra/scripts
 *         pnpm exec ts-node apply-phase6-flag-fixes.ts --dry-run   # report only
 *         pnpm exec ts-node apply-phase6-flag-fixes.ts --apply     # write to prod
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

interface Fix {
  dishId: string;
  dish: string; // for logging only
  keptPrice: number; // guard: abort row if live price differs
  group: string; // option_group.name
  option: string; // options.name
  delta: number; // options.price_delta
  protein?: 'chicken' | 'vegan'; // options.primary_protein override
}

// Group naming: size words → "Tamaño" · portion/count → "Porción" ·
// protein add-ons → "Ingrediente extra" (strips leading "Con ") · vegan version → "Versión".
const FIXES: Fix[] = [
  // ── Casi Esquina Pizza Bar — pizzas: Grande +60 ──
  {
    dishId: 'dc8e5d62-a360-45a5-852a-788d315de396',
    dish: 'AZTECA',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: '69b82009-b321-40c9-ab76-926ef7326ecf',
    dish: 'DEL MUERTO',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: '37d66baf-305a-4126-9df3-f4462efa0c58',
    dish: 'DI PERA E GORGONZOLA',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: 'af1541f2-5351-4077-8284-24d413163c52',
    dish: 'DONATELLO',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: 'fd7a9c51-a87d-4cc1-a1ef-0961b971db87',
    dish: 'ELBA ESTHER',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: 'b5bb2e89-f349-46e8-bca3-75054f725a87',
    dish: 'LYN MAY',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: 'cc870f36-856b-45c2-85f4-f3ee74c35fdb',
    dish: 'MARGHERITA',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: '0c3f3756-da8c-4368-83a4-8a75498da1a6',
    dish: 'NOA NOA',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: '4d1cd869-efde-4e3a-9d8e-0238ee7994b5',
    dish: 'PEPPERONI',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: '17c55db6-ecca-4fc9-8497-b0cf0655d7cd',
    dish: 'PIRI',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: '7fb302af-f643-4c22-8523-9b8310b15681',
    dish: 'PIZZA AL PASTOR',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 59.99,
  },
  {
    dishId: '53b557e9-964b-430d-a346-1c83a4e84b81',
    dish: 'POPEYE',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: '89b7fb94-375d-4557-93c4-c4ea9bbe60e8',
    dish: 'PROSCIUTTO E FUNGHI',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: '2343a21c-7e32-4c58-ad47-e1ff263b7718',
    dish: 'QUATTRO FORMAGGI',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: 'd1299355-0490-4da0-9232-518aae22d556',
    dish: 'SALAME',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: 'f7495ea1-9bc7-4f33-8c38-c92502a84f61',
    dish: 'TRAVIESA',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  {
    dishId: 'bfb21704-88ff-41ef-a1f1-32b78ac2f554',
    dish: 'VEGETARIANA',
    keptPrice: 225,
    group: 'Tamaño',
    option: 'Grande',
    delta: 60,
  },
  // ── Casi Esquina — salads / pastas / antojitos ──
  {
    dishId: '7374d796-2c87-438b-98f3-ee2e9c7c43fa',
    dish: 'ENSALADA CÉSAR',
    keptPrice: 115,
    group: 'Ingrediente extra',
    option: 'Pollo',
    delta: 90,
    protein: 'chicken',
  },
  {
    dishId: '50622b8c-7b84-4e54-8c68-f0e694b8564a',
    dish: 'ENSALADA QUASI',
    keptPrice: 125,
    group: 'Tamaño',
    option: 'Grande',
    delta: 40,
  },
  {
    dishId: '4e639375-d098-4f28-bbc0-152344574981',
    dish: 'Fetuccini Alfredo',
    keptPrice: 195,
    group: 'Ingrediente extra',
    option: 'Pechuga de pollo (160g)',
    delta: 60,
    protein: 'chicken',
  },
  {
    dishId: 'fef50eef-78e1-45a7-97c9-1bc0043fb710',
    dish: 'FETUCCINI NAPOLITANA',
    keptPrice: 175,
    group: 'Ingrediente extra',
    option: 'Pechuga de pollo (160g)',
    delta: 60,
    protein: 'chicken',
  },
  {
    dishId: 'b3b3d5a7-54a6-4730-b35d-7432e55ad781',
    dish: 'FUSILLI AL PESTO',
    keptPrice: 195,
    group: 'Ingrediente extra',
    option: 'Pechuga de pollo (160g)',
    delta: 60,
    protein: 'chicken',
  },
  {
    dishId: '66944426-6e93-45d9-a35c-96cc32f09a88',
    dish: 'Fusilli Arrabiata',
    keptPrice: 175,
    group: 'Ingrediente extra',
    option: 'Pechuga de pollo (160g)',
    delta: 60,
    protein: 'chicken',
  },
  {
    dishId: '7f039c9f-eb88-47dd-9eeb-d676779f4db7',
    dish: 'Spaghetti Aglio Olio',
    keptPrice: 175,
    group: 'Ingrediente extra',
    option: 'Pechuga de pollo (160g)',
    delta: 60,
    protein: 'chicken',
  },
  {
    dishId: 'a0d0585b-5231-4706-b869-b8795d0e0edd',
    dish: 'SPAGHETTI AL BURRO',
    keptPrice: 175,
    group: 'Ingrediente extra',
    option: 'Pechuga de pollo (160g)',
    delta: 60,
    protein: 'chicken',
  },
  {
    dishId: 'd11f444a-effd-4830-bb81-6b176f23da65',
    dish: 'Sopes de Cochinita',
    keptPrice: 35,
    group: 'Porción',
    option: 'Orden de tres',
    delta: 60,
  },
  {
    dishId: 'd884fa40-3d20-4b46-92e2-d5ff7c75e66e',
    dish: 'Tacos de Cochinita',
    keptPrice: 35,
    group: 'Porción',
    option: 'Orden de tres',
    delta: 40,
  },
  // ── Restaurante Catorze ──
  {
    dishId: '11f980c5-eff4-4676-9c34-7bf5d66e4a4b',
    dish: 'Boquerones en vinagre',
    keptPrice: 190,
    group: 'Porción',
    option: '10 uds',
    delta: 140,
  },
  {
    dishId: 'b8b9aa32-a224-47fc-bb45-47351e5f2e3e',
    dish: 'Chorizo ibérico de bellota',
    keptPrice: 195,
    group: 'Porción',
    option: '100 gr.',
    delta: 100,
  },
  {
    dishId: '101229f5-110c-428b-ab42-9c8873655114',
    dish: 'Croquetas de jamón serrano',
    keptPrice: 160,
    group: 'Porción',
    option: '8 pz',
    delta: 130,
  },
  {
    dishId: '4af8eb40-b742-40c6-845a-7e7842e2b225',
    dish: 'Cubo de helado de pistache',
    keptPrice: 380,
    group: 'Tamaño',
    option: 'GRANDE (4 personas)',
    delta: 380,
  },
  {
    dishId: 'd589e9e5-06ad-4ac1-87a4-006049517204',
    dish: 'Ensalada de tomate con ventresca',
    keptPrice: 450,
    group: 'Versión',
    option: 'Sin ventresca (Querido Vegano)',
    delta: -260,
    protein: 'vegan',
  },
  {
    dishId: '96462e39-6319-4ebb-9715-1cd6d5c35e99',
    dish: 'Ensaladilla rusa clásica',
    keptPrice: 190,
    group: 'Porción',
    option: '1 ración',
    delta: 160,
  },
  {
    dishId: 'd031c583-0414-45b8-92dc-227b57b37b5d',
    dish: 'Flores de calabaza en tempura',
    keptPrice: 160,
    group: 'Porción',
    option: '1 ración',
    delta: 130,
  },
  {
    dishId: '8c2188ac-a0e9-428f-9974-b7811274a9d4',
    dish: 'Jamón ibérico de bellota 50%',
    keptPrice: 350,
    group: 'Porción',
    option: '100 gr.',
    delta: 340,
  },
  {
    dishId: 'e17253db-6b74-43c4-810e-b53f33d68044',
    dish: 'Queso manchego curado',
    keptPrice: 295,
    group: 'Porción',
    option: '100 gr.',
    delta: 145,
  },
  {
    dishId: '87fa9771-a15f-4000-8109-354b6c89e13e',
    dish: 'Salchichón ibérico de bellota',
    keptPrice: 195,
    group: 'Porción',
    option: '100 gr.',
    delta: 100,
  },
  {
    dishId: 'fe0a92fe-37fd-4b24-9dbe-ef34e044798e',
    dish: 'Tacos de lechón, piña y chipotle',
    keptPrice: 160,
    group: 'Porción',
    option: '4 pz',
    delta: 100,
  },
  // ── SUMO Buffet Zona Rosa ──
  {
    dishId: 'b16c7933-f607-4881-896c-f4d3701f817c',
    dish: 'ALITAS',
    keptPrice: 189,
    group: 'Porción',
    option: '25 piezas (incluye 2 aderezos, 3 salsas a elegir)',
    delta: 180,
  },
  // ── Sushi Roll ──
  {
    dishId: '0378fdfc-5a74-4c9f-8001-9cd2785549bc',
    dish: 'Atún',
    keptPrice: 179,
    group: 'Tamaño',
    option: 'Corte grueso',
    delta: 82,
  },
  {
    dishId: '7c1610a6-fae6-4229-b8df-86a00728965b',
    dish: 'Chicken Ramen',
    keptPrice: 204,
    group: 'Tamaño',
    option: 'Grande',
    delta: 56,
  },
  {
    dishId: '932e67e5-33d9-4c1c-8f99-5d4bb10d4d24',
    dish: 'Mixto',
    keptPrice: 228,
    group: 'Tamaño',
    option: 'Corte grueso',
    delta: 125,
  },
  {
    dishId: '0cbedbd7-573f-43e3-ba70-423240f0e4ad',
    dish: 'Mixto Especial',
    keptPrice: 270,
    group: 'Tamaño',
    option: 'Corte grueso',
    delta: 83,
  },
  {
    dishId: 'f6dab426-0338-4df1-8f41-33d3662b8400',
    dish: 'Pulpo',
    keptPrice: 201,
    group: 'Tamaño',
    option: 'Corte grueso',
    delta: 75,
  },
  {
    dishId: 'fa6ed079-0f10-4378-a9b7-01ada2efe8a1',
    dish: 'Ramen Chashu',
    keptPrice: 204,
    group: 'Tamaño',
    option: 'Grande',
    delta: 56,
  },
  {
    dishId: 'fbf6e591-cbd1-4747-8fea-1c3c827cf302',
    dish: 'Robalo',
    keptPrice: 201,
    group: 'Tamaño',
    option: 'Corte grueso',
    delta: 75,
  },
  {
    dishId: 'aee48219-5e75-4615-a546-f1e1eed4bf85',
    dish: 'Salmón',
    keptPrice: 201,
    group: 'Tamaño',
    option: 'Corte grueso',
    delta: 75,
  },
  {
    dishId: '3755c2da-0661-47bd-bc7b-39dacc016369',
    dish: 'Salmón Ahumado',
    keptPrice: 228,
    group: 'Tamaño',
    option: 'Corte grueso',
    delta: 70,
  },
  {
    dishId: '0bd5b5d2-621d-49a1-b047-fa5e0ee5daee',
    dish: 'Salmon Ramen',
    keptPrice: 204,
    group: 'Tamaño',
    option: 'Grande',
    delta: 56,
  },
  {
    dishId: '689f1720-c048-4040-b037-15425618b760',
    dish: 'Spicy Miso Ramen Beef',
    keptPrice: 204,
    group: 'Tamaño',
    option: 'Grande',
    delta: 56,
  },
];

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;
  console.log(
    `\n=== Phase 6 flag fixes — ${dryRun ? 'DRY RUN (no writes)' : '⚠ APPLYING to ' + process.env.SUPABASE_URL} — ${FIXES.length} fixes ===\n`
  );

  let ok = 0,
    skipped = 0,
    failed = 0;
  for (const f of FIXES) {
    const { data: d, error } = await sb
      .from('dishes')
      .select('id,name,price,restaurant_id,option_groups(id,name)')
      .eq('id', f.dishId)
      .single();
    if (error || !d) {
      console.log(`✗ ${f.dish}: dish not found (${error?.message})`);
      failed++;
      continue;
    }
    if (Number(d.price) !== f.keptPrice) {
      console.log(
        `⊘ ${f.dish}: live price $${d.price} ≠ checklist $${f.keptPrice} — changed since generation, skipping`
      );
      skipped++;
      continue;
    }
    if ((d.option_groups ?? []).some((g: any) => g.name === f.group)) {
      console.log(`⊘ ${f.dish}: group "${f.group}" already exists, skipping (already applied?)`);
      skipped++;
      continue;
    }
    const existingGroups = d.option_groups?.length ?? 0;
    console.log(
      `${dryRun ? '·' : '✓'} ${f.dish} ($${f.keptPrice}) → "${f.group}" / "${f.option}" ${f.delta >= 0 ? '+' : ''}$${f.delta}${f.protein ? ` [${f.protein}]` : ''}${existingGroups ? ` (dish already has ${existingGroups} other group(s))` : ''}`
    );
    if (dryRun) {
      ok++;
      continue;
    }

    const { data: g, error: ge } = await sb
      .from('option_groups')
      .insert({
        restaurant_id: d.restaurant_id,
        dish_id: f.dishId,
        name: f.group,
        selection_type: 'single',
        min_selections: 0,
        max_selections: 1,
        display_order: existingGroups,
        is_active: true,
        display_in_card: false,
      })
      .select('id')
      .single();
    if (ge) {
      console.log(`  ✗ group insert failed: ${ge.message}`);
      failed++;
      continue;
    }
    const { error: oe } = await sb.from('options').insert({
      option_group_id: g.id,
      name: f.option,
      price_delta: f.delta,
      primary_protein: f.protein ?? null,
      is_default: false,
      display_order: 0,
      is_available: true,
    });
    if (oe) {
      console.log(`  ✗ option insert failed (removing group): ${oe.message}`);
      await sb.from('option_groups').delete().eq('id', g.id);
      failed++;
      continue;
    }
    ok++;
  }
  console.log(
    `\n${dryRun ? 'Would apply' : 'Applied'}: ${ok} · skipped: ${skipped} · failed: ${failed}`
  );
  if (dryRun) console.log('Re-run with --apply to write.\n');
}

main();
