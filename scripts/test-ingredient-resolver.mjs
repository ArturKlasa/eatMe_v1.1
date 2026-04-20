/**
 * Phase 3 smoke test — exercises the resolver against the real DB with a
 * handful of curated inputs that cover each match stage.
 *
 * Run:
 *   node scripts/test-ingredient-resolver.mjs
 *
 * Asserts nothing — prints a table so you can visually verify:
 *   - full-phrase matches return variant_id directly
 *   - concept+modifier matches resolve both IDs
 *   - novel modifiers auto-create a needs_review variant
 *   - unknown terms hit the translate+retry path
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../apps/web-portal/.env.local');
const env = readFileSync(envPath, 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const SUPABASE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const OPENAI_API_KEY = env.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not found in apps/web-portal/.env.local');
  process.exit(1);
}

// Mirror of the resolver's behaviour — direct REST calls so we don't have to
// spin up the Next.js runtime just to test DB-side logic.
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const norm = s => s.toLowerCase().trim();

async function lookupAlias(key) {
  const rows = await rest(
    `ingredient_aliases_v2?alias_text=eq.${encodeURIComponent(key)}&select=alias_text,language,concept_id,variant_id,concept:ingredient_concepts!inner(slug,legacy_canonical_id)&limit=5`
  );
  return rows;
}

async function variantsFor(conceptId) {
  return rest(
    `ingredient_variants?concept_id=eq.${conceptId}&select=id,modifier,is_default,needs_review`
  );
}

const cases = [
  // Stage 1/2 — should match an existing concept
  { base: 'salmón', modifier: null, note: 'ES base → salmon concept' },
  { base: 'salmon', modifier: 'smoked', note: 'EN base + modifier → may auto-create variant' },
  { base: 'queso', modifier: 'fresco', note: 'ES base + ES modifier' },
  { base: 'tomate', modifier: null, note: 'ES vegetable' },
  { base: 'chapulines', modifier: null, note: 'Mexican ingredient' },
  { base: 'garbanzo', modifier: 'asado', note: 'Roasted chickpea — novel modifier likely' },
  // Stage 4 — unknown term, should hit translate fallback
  { base: 'ziemniak', modifier: null, note: 'PL potato — should resolve to potato concept' },
  { base: 'tocino', modifier: null, note: 'ES bacon' },
];

console.log('Phase 3 resolver smoke test\n');

for (const { base, modifier, note } of cases) {
  const baseKey = norm(base);
  const fullKey = modifier ? `${norm(modifier)} ${baseKey}` : null;

  const fullHits = fullKey ? await lookupAlias(fullKey) : [];
  const baseHits = await lookupAlias(baseKey);

  let resolvedAs = 'unmatched';
  let conceptId = null;
  let variantId = null;

  if (fullHits.length > 0) {
    resolvedAs = `full-phrase alias → concept=${fullHits[0].concept.slug}`;
    conceptId = fullHits[0].concept_id;
    variantId = fullHits[0].variant_id;
  } else if (baseHits.length > 0) {
    const hit = baseHits[0];
    conceptId = hit.concept_id;
    const variants = await variantsFor(conceptId);
    if (modifier) {
      const match = variants.find(v => v.modifier && v.modifier.toLowerCase() === modifier.toLowerCase());
      if (match) {
        resolvedAs = `concept+variant (existing): ${hit.concept.slug} / ${match.modifier}`;
        variantId = match.id;
      } else {
        resolvedAs = `concept hit but NOVEL modifier → would auto-create needs_review variant for "${modifier}"`;
      }
    } else {
      const def = variants.find(v => v.is_default);
      resolvedAs = `concept (default variant): ${hit.concept.slug}`;
      variantId = def?.id ?? null;
    }
  } else {
    resolvedAs = 'unmatched — would trigger translate+retry';
  }

  console.log(`[${base}${modifier ? ' / ' + modifier : ''}]  (${note})`);
  console.log(`    → ${resolvedAs}`);
  console.log(`    concept_id=${conceptId ?? '-'}  variant_id=${variantId ?? '-'}\n`);
}

// Summary of current needs_review variants in the DB
const needsReview = await rest(
  `ingredient_variants?needs_review=eq.true&select=id,concept_id,modifier&limit=20`
);
console.log(`needs_review variants in DB: ${needsReview.length}`);
needsReview.forEach(v => console.log(`  ${v.modifier} (concept=${v.concept_id})`));
