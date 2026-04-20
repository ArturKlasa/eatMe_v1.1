#!/usr/bin/env node
// scripts/load-ingredient-seed.mjs
//
// Upserts ingredient concepts, variants, translations, and aliases from a
// JSON seed file into Supabase. Idempotent — safe to re-run. Uses service
// role key so RLS doesn't block writes.
//
// Usage:
//   node scripts/load-ingredient-seed.mjs [path-to-seed.json]
//   (defaults to .agents/planning/ingredients-trial-sample.json)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SEED = path.join(REPO_ROOT, '.agents/planning/ingredients-trial-sample.json');
const ENV_FILE = path.join(REPO_ROOT, 'apps/web-portal/.env.local');

// ── Read env ────────────────────────────────────────────────────────────────
function loadEnv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv(ENV_FILE);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in', ENV_FILE);
  process.exit(1);
}

// ── Minimal PostgREST client ────────────────────────────────────────────────
async function request(method, endpoint, body = null, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${endpoint} → ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// resolution: 'merge-duplicates' = update on conflict; 'ignore-duplicates' = skip
async function upsert(table, rows, conflictCols, resolution = 'merge-duplicates') {
  if (!rows.length) return [];
  return request('POST', `${table}?on_conflict=${conflictCols}`, rows, {
    Prefer: `resolution=${resolution},return=representation`,
  });
}

// Partial unique indexes don't work with PostgREST on_conflict, so variants
// use get-or-create instead of upsert.
async function getOrCreateVariant(concept_id, modifier, is_default) {
  let filter = `concept_id=eq.${concept_id}`;
  filter += modifier === null ? '&modifier=is.null' : `&modifier=eq.${encodeURIComponent(modifier)}`;
  const existing = await request('GET', `ingredient_variants?${filter}&select=id`);
  if (existing && existing.length) return { id: existing[0].id, created: false };

  const inserted = await request(
    'POST',
    'ingredient_variants?select=id',
    [{ concept_id, modifier, is_default }],
    { Prefer: 'return=representation' },
  );
  return { id: inserted[0].id, created: true };
}

// ── Concept loader ──────────────────────────────────────────────────────────
async function loadConcept(c, stats) {
  // 1. Upsert concept. Conflict on slug preserves legacy_canonical_id (column
  // not in body → UPDATE SET only touches columns we send).
  const [concept] = await upsert(
    'ingredient_concepts',
    [
      {
        slug: c.slug,
        family: c.family,
        is_vegetarian: c.is_vegetarian,
        is_vegan: c.is_vegan,
        allergens: c.allergens ?? [],
      },
    ],
    'slug',
  );
  stats.concepts++;

  // 2. Variants — default (pre-existing from backfill, or create) + named.
  const variantIdByModifier = new Map(); // null | string → uuid
  for (const v of c.variants ?? []) {
    if (v.is_default && !v.modifier) {
      const { id, created } = await getOrCreateVariant(concept.id, null, true);
      variantIdByModifier.set(null, id);
      if (created) stats.variants++;
    } else if (v.modifier) {
      const { id, created } = await getOrCreateVariant(concept.id, v.modifier, false);
      variantIdByModifier.set(v.modifier, id);
      if (created) stats.variants++;
    }
  }

  // 3. Concept translations — upsert all languages.
  const conceptTranslationRows = Object.entries(c.translations ?? {}).map(
    ([lang, name]) => ({ concept_id: concept.id, language: lang, name }),
  );
  if (conceptTranslationRows.length) {
    await upsert('concept_translations', conceptTranslationRows, 'concept_id,language');
    stats.translations += conceptTranslationRows.length;
  }

  // 4. Variant translations — for each variant that has translations.
  for (const v of c.variants ?? []) {
    const variantId = variantIdByModifier.get(v.modifier ?? null);
    if (!variantId || !v.translations) continue;
    const rows = Object.entries(v.translations).map(([lang, name]) => ({
      variant_id: variantId,
      language: lang,
      name,
    }));
    if (rows.length) {
      await upsert('variant_translations', rows, 'variant_id,language');
      stats.variantTranslations += rows.length;
    }
  }

  // 5. Aliases — concept-level only for now (variant-level seeding TODO when
  // seed JSON grows that level). Deduplicate (alias_text, language) within
  // this concept's set. Use ignore-duplicates so cross-concept collisions
  // (e.g. "pepper" between bell_pepper and pepper_black) don't clobber the
  // first writer; admin review queue will handle conflicts.
  const aliasRows = [];
  const seenInConcept = new Set();
  for (const [lang, list] of Object.entries(c.aliases ?? {})) {
    for (const raw of list) {
      const alias_text = raw.toLowerCase().trim();
      const key = `${alias_text}|${lang}`;
      if (seenInConcept.has(key)) continue;
      seenInConcept.add(key);
      aliasRows.push({
        alias_text,
        language: lang,
        concept_id: concept.id,
        variant_id: null,
      });
    }
  }
  if (aliasRows.length) {
    const inserted = await upsert(
      'ingredient_aliases_v2',
      aliasRows,
      'alias_text,language',
      'ignore-duplicates',
    );
    stats.aliases += inserted ? inserted.length : 0;
    stats.aliasesSkipped += aliasRows.length - (inserted ? inserted.length : 0);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const seedPath = path.resolve(process.argv[2] || DEFAULT_SEED);
  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`);
    process.exit(1);
  }

  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const concepts = seed.concepts ?? [];
  console.log(`Loading ${concepts.length} concept(s) from ${path.relative(REPO_ROOT, seedPath)}`);
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('');

  const stats = {
    concepts: 0,
    variants: 0,
    translations: 0,
    variantTranslations: 0,
    aliases: 0,
    aliasesSkipped: 0,
    errors: [],
  };

  let i = 0;
  for (const c of concepts) {
    i++;
    const prefix = `[${String(i).padStart(String(concepts.length).length)}/${concepts.length}]`;
    try {
      await loadConcept(c, stats);
      console.log(`${prefix} ✓ ${c.slug}`);
    } catch (err) {
      stats.errors.push({ slug: c.slug, error: err.message });
      console.log(`${prefix} ✗ ${c.slug} — ${err.message}`);
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`  concepts upserted:     ${stats.concepts}`);
  console.log(`  variants upserted:     ${stats.variants}`);
  console.log(`  concept translations:  ${stats.translations}`);
  console.log(`  variant translations:  ${stats.variantTranslations}`);
  console.log(`  aliases inserted:      ${stats.aliases}`);
  console.log(`  aliases skipped (dup): ${stats.aliasesSkipped}`);
  if (stats.errors.length) {
    console.log('');
    console.log(`  errors (${stats.errors.length}):`);
    stats.errors.forEach((e) => console.log(`    ${e.slug}: ${e.error}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
