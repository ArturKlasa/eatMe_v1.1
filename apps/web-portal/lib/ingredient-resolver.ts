/**
 * Ingredient resolver (Phase 3).
 *
 * Matches GPT-extracted {base, modifier} ingredient tuples against the new
 * ingredient_aliases_v2 / ingredient_concepts / ingredient_variants tables.
 *
 * Match priority per ingredient:
 *   1. Full-phrase alias — "<base> <modifier>" or "<modifier> <base>" resolves
 *      directly through an alias (may point at a specific variant).
 *   2. Base alias → concept:
 *      2a. If modifier exists: find variant by modifier text (or auto-create
 *          with needs_review=true).
 *      2b. If no modifier: use the concept's default variant.
 *   3. Translate base + modifier to English and retry stages 1–2.
 *
 * The resolver always produces legacy_canonical_id too so the caller can
 * populate dish_ingredients.ingredient_id during the Phase 3 transition.
 */

import OpenAI from 'openai';
import type { createServerSupabaseClient } from './supabase-server';
import type { MatchedIngredient, RawExtractedIngredient } from './menu-scan';

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

interface AliasHit {
  alias_text: string;
  language: string;
  concept_id: string;
  variant_id: string | null;
  concept_slug: string;
  legacy_canonical_id: string | null;
}

interface VariantRow {
  id: string;
  concept_id: string;
  modifier: string | null;
  is_default: boolean;
}

const norm = (s: string) => s.toLowerCase().trim();

/** Build the set of alias keys to probe for a given raw ingredient. */
function aliasKeysFor(raw: RawExtractedIngredient): { fullPhrase: string[]; baseOnly: string } {
  const base = norm(raw.base);
  const modifier = raw.modifier ? norm(raw.modifier) : null;
  const fullPhrase: string[] = [];
  if (modifier) {
    fullPhrase.push(`${modifier} ${base}`);
    fullPhrase.push(`${base} ${modifier}`);
  }
  return { fullPhrase, baseOnly: base };
}

/**
 * Bulk-fetch alias rows for a set of lowercase alias_text values.
 * Joins concept to surface slug + legacy_canonical_id in one trip.
 */
async function bulkLookupAliasesV2(
  keys: string[],
  supabase: SupabaseClient
): Promise<Map<string, AliasHit>> {
  const out = new Map<string, AliasHit>();
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return out;

  const { data, error } = await supabase
    .from('ingredient_aliases_v2')
    .select(
      'alias_text, language, concept_id, variant_id, concept:ingredient_concepts!inner(slug, legacy_canonical_id)'
    )
    .in('alias_text', unique);

  if (error) {
    console.error('[IngredientResolver] alias lookup failed:', error);
    return out;
  }

  for (const row of (data ?? []) as unknown as Array<{
    alias_text: string;
    language: string;
    concept_id: string;
    variant_id: string | null;
    concept: { slug: string; legacy_canonical_id: string | null };
  }>) {
    const key = row.alias_text.toLowerCase();
    // Prefer the first hit; multiple languages can share the same alias_text
    // (alias_text is unique only per language), so we keep the first match.
    if (!out.has(key)) {
      out.set(key, {
        alias_text: row.alias_text,
        language: row.language,
        concept_id: row.concept_id,
        variant_id: row.variant_id,
        concept_slug: row.concept.slug,
        legacy_canonical_id: row.concept.legacy_canonical_id,
      });
    }
  }
  return out;
}

/** Fetch all variants for a set of concepts so we can match modifiers in memory. */
async function bulkLoadVariants(
  conceptIds: string[],
  supabase: SupabaseClient
): Promise<Map<string, VariantRow[]>> {
  const byConcept = new Map<string, VariantRow[]>();
  const unique = [...new Set(conceptIds)];
  if (unique.length === 0) return byConcept;

  const { data, error } = await supabase
    .from('ingredient_variants')
    .select('id, concept_id, modifier, is_default')
    .in('concept_id', unique);

  if (error) {
    console.error('[IngredientResolver] variant lookup failed:', error);
    return byConcept;
  }

  for (const v of (data ?? []) as VariantRow[]) {
    const list = byConcept.get(v.concept_id) ?? [];
    list.push(v);
    byConcept.set(v.concept_id, list);
  }
  return byConcept;
}

/** Pick the variant that best matches a modifier; null if none match. */
function findVariantByModifier(
  variants: VariantRow[] | undefined,
  modifier: string
): VariantRow | null {
  if (!variants) return null;
  const target = norm(modifier);
  for (const v of variants) {
    if (v.modifier && norm(v.modifier) === target) return v;
  }
  return null;
}

function pickDefaultVariant(variants: VariantRow[] | undefined): VariantRow | null {
  if (!variants) return null;
  return variants.find(v => v.is_default) ?? null;
}

/**
 * Create a new variant with needs_review=true for a novel modifier.
 * Returns the new variant row, or null on failure.
 */
async function createReviewVariant(
  conceptId: string,
  modifier: string,
  supabase: SupabaseClient
): Promise<VariantRow | null> {
  const { data, error } = await supabase
    .from('ingredient_variants')
    .insert({
      concept_id: conceptId,
      modifier: modifier.trim(),
      is_default: false,
      needs_review: true,
    })
    .select('id, concept_id, modifier, is_default')
    .single();

  if (error || !data) {
    // Likely a concurrent insert hit the partial unique index — look up and
    // return the existing row instead of failing the whole extraction.
    const { data: existing } = await supabase
      .from('ingredient_variants')
      .select('id, concept_id, modifier, is_default')
      .eq('concept_id', conceptId)
      .eq('modifier', modifier.trim())
      .maybeSingle();
    return (existing as VariantRow | null) ?? null;
  }
  return data as VariantRow;
}

/**
 * Translate a set of raw ingredients to English via gpt-4o-mini.
 * Returns a map keyed by "base|modifier" → { base, modifier }.
 */
async function translateIngredientsBatch(
  raws: RawExtractedIngredient[],
  openai: OpenAI,
  menuLanguage: string
): Promise<Map<string, RawExtractedIngredient>> {
  const out = new Map<string, RawExtractedIngredient>();
  if (raws.length === 0) return out;

  const langHint =
    menuLanguage !== 'und' && menuLanguage !== 'en'
      ? ` The ingredient terms are in ${menuLanguage}.`
      : ' The ingredient terms may be in any language.';

  const items = raws.map(r => ({ base: r.base, modifier: r.modifier }));

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a culinary ingredient translator.${langHint} For each {base, modifier} pair in the input array, return the same pair translated to standard English culinary terms. If a term is already a well-known English culinary term (pierogi, tofu, naan), keep it unchanged. Preserve the pair structure exactly. Respond with JSON: {"translations":[{"base":"...","modifier":"..."|null}, ...]}.`,
        },
        { role: 'user', content: JSON.stringify(items) },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
      temperature: 0.1,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
      translations?: Array<{ base?: string; modifier?: string | null }>;
    };
    const translations = parsed.translations ?? [];
    for (let i = 0; i < raws.length && i < translations.length; i++) {
      const orig = raws[i];
      const t = translations[i];
      if (!t?.base) continue;
      const key = `${norm(orig.base)}|${orig.modifier ? norm(orig.modifier) : ''}`;
      out.set(key, {
        base: t.base,
        modifier: t.modifier ?? null,
      });
    }
  } catch (err) {
    console.error('[IngredientResolver] translation fallback failed:', err);
  }
  return out;
}

function unmatched(raw: RawExtractedIngredient): MatchedIngredient {
  return {
    raw_text: raw.modifier ? `${raw.modifier} ${raw.base}` : raw.base,
    raw_modifier: raw.modifier,
    status: 'unmatched',
  };
}

function buildMatched(
  raw: RawExtractedIngredient,
  concept: { id: string; slug: string; legacy_canonical_id: string | null },
  variantId: string | null
): MatchedIngredient {
  return {
    raw_text: raw.modifier ? `${raw.modifier} ${raw.base}` : raw.base,
    raw_modifier: raw.modifier,
    status: 'matched',
    concept_id: concept.id,
    variant_id: variantId,
    canonical_ingredient_id: concept.legacy_canonical_id ?? undefined,
    canonical_name: concept.slug,
    display_name: raw.base,
  };
}

/**
 * Main entry point. Resolves raw ingredients to matched ingredients
 * using the new tables with auto-variant creation for novel modifiers.
 */
export async function resolveIngredients(
  raws: RawExtractedIngredient[],
  supabase: SupabaseClient,
  openai: OpenAI,
  menuLanguage: string
): Promise<MatchedIngredient[]> {
  if (raws.length === 0) return [];

  // ---------- Stage 1+2 preparation: collect all alias keys ----------
  const allKeys: string[] = [];
  for (const raw of raws) {
    const { fullPhrase, baseOnly } = aliasKeysFor(raw);
    allKeys.push(...fullPhrase, baseOnly);
  }
  const aliasMap = await bulkLookupAliasesV2(allKeys, supabase);

  // Gather matched concept IDs so we can bulk-load their variants
  const matchedConceptIds = new Set<string>();
  for (const hit of aliasMap.values()) matchedConceptIds.add(hit.concept_id);
  const variantMap = await bulkLoadVariants([...matchedConceptIds], supabase);

  // ---------- First-pass resolution ----------
  const results: MatchedIngredient[] = [];
  const needsTranslation: Array<{ index: number; raw: RawExtractedIngredient }> = [];

  for (let i = 0; i < raws.length; i++) {
    const raw = raws[i];
    const resolved = resolveOnePass(raw, aliasMap, variantMap);
    if (resolved) {
      results.push(resolved);
    } else {
      // placeholder; may be filled by stage 4 or auto-variant creation below
      results.push(unmatched(raw));
      needsTranslation.push({ index: i, raw });
    }
  }

  // ---------- Auto-create variants for matched concepts with novel modifiers ----------
  // This handles the case where stage 2 resolved the concept but the modifier
  // didn't match any existing variant — we create one with needs_review=true.
  for (let i = 0; i < raws.length; i++) {
    if (results[i].status !== 'unmatched') continue;
    const raw = raws[i];
    if (!raw.modifier) continue;
    const baseKey = norm(raw.base);
    const baseHit = aliasMap.get(baseKey);
    if (!baseHit) continue; // concept not found via base alone — stage 4 will handle

    const variants = variantMap.get(baseHit.concept_id);
    const existing = findVariantByModifier(variants, raw.modifier);
    if (existing) {
      results[i] = buildMatched(
        raw,
        {
          id: baseHit.concept_id,
          slug: baseHit.concept_slug,
          legacy_canonical_id: baseHit.legacy_canonical_id,
        },
        existing.id
      );
      continue;
    }
    const created = await createReviewVariant(baseHit.concept_id, raw.modifier, supabase);
    if (created) {
      // Cache the new variant so sibling raws referencing the same modifier
      // don't insert a duplicate.
      const list = variantMap.get(baseHit.concept_id) ?? [];
      list.push(created);
      variantMap.set(baseHit.concept_id, list);
      results[i] = buildMatched(
        raw,
        {
          id: baseHit.concept_id,
          slug: baseHit.concept_slug,
          legacy_canonical_id: baseHit.legacy_canonical_id,
        },
        created.id
      );
    }
  }

  // Refresh the list of still-unmatched raws for translation
  const stillUnmatched = needsTranslation.filter(
    ({ index }) => results[index].status === 'unmatched'
  );
  if (stillUnmatched.length === 0) return results;

  // ---------- Stage 4: translate + retry ----------
  const translations = await translateIngredientsBatch(
    stillUnmatched.map(({ raw }) => raw),
    openai,
    menuLanguage
  );
  if (translations.size === 0) return results;

  // Build translated raws and new alias keys
  const translatedRaws: Array<{
    index: number;
    originalRaw: RawExtractedIngredient;
    translated: RawExtractedIngredient;
  }> = [];
  const translatedKeys: string[] = [];
  for (const { index, raw } of stillUnmatched) {
    const key = `${norm(raw.base)}|${raw.modifier ? norm(raw.modifier) : ''}`;
    const translated = translations.get(key);
    if (!translated) continue;
    // Skip if translation equals the original (no new info)
    if (
      norm(translated.base) === norm(raw.base) &&
      (translated.modifier ?? null) === (raw.modifier ?? null)
    ) {
      continue;
    }
    translatedRaws.push({ index, originalRaw: raw, translated });
    const { fullPhrase, baseOnly } = aliasKeysFor(translated);
    translatedKeys.push(...fullPhrase, baseOnly);
  }
  if (translatedRaws.length === 0) return results;

  const translatedAliasMap = await bulkLookupAliasesV2(translatedKeys, supabase);

  // Bulk-load variants for any newly-matched concepts
  const newConceptIds = new Set<string>();
  for (const hit of translatedAliasMap.values()) {
    if (!variantMap.has(hit.concept_id)) newConceptIds.add(hit.concept_id);
  }
  const newVariantMap = await bulkLoadVariants([...newConceptIds], supabase);
  for (const [k, v] of newVariantMap) variantMap.set(k, v);

  for (const { index, originalRaw, translated } of translatedRaws) {
    const resolved = resolveOnePass(translated, translatedAliasMap, variantMap);
    if (resolved) {
      // Preserve the raw_text and raw_modifier from the original menu text
      // so reviewers see what was on the menu, not the translated form.
      results[index] = {
        ...resolved,
        raw_text: originalRaw.modifier
          ? `${originalRaw.modifier} ${originalRaw.base}`
          : originalRaw.base,
        raw_modifier: originalRaw.modifier,
      };
      continue;
    }
    // Try auto-creating a variant if the translated base found a concept
    const baseKey = norm(translated.base);
    const baseHit = translatedAliasMap.get(baseKey);
    if (baseHit && translated.modifier) {
      const created = await createReviewVariant(baseHit.concept_id, translated.modifier, supabase);
      if (created) {
        results[index] = {
          ...buildMatched(
            translated,
            {
              id: baseHit.concept_id,
              slug: baseHit.concept_slug,
              legacy_canonical_id: baseHit.legacy_canonical_id,
            },
            created.id
          ),
          raw_text: originalRaw.modifier
            ? `${originalRaw.modifier} ${originalRaw.base}`
            : originalRaw.base,
          raw_modifier: originalRaw.modifier,
        };
      }
    }
  }

  return results;
}

/**
 * Attempt alias-based resolution for a single raw ingredient using cached
 * alias + variant lookups. Returns null when no hit is found; caller decides
 * whether to escalate (auto-create variant or translate+retry).
 */
function resolveOnePass(
  raw: RawExtractedIngredient,
  aliasMap: Map<string, AliasHit>,
  variantMap: Map<string, VariantRow[]>
): MatchedIngredient | null {
  const { fullPhrase, baseOnly } = aliasKeysFor(raw);

  // Stage 1 — full phrase hit (alias may point directly at a variant)
  for (const key of fullPhrase) {
    const hit = aliasMap.get(key);
    if (!hit) continue;
    const concept = {
      id: hit.concept_id,
      slug: hit.concept_slug,
      legacy_canonical_id: hit.legacy_canonical_id,
    };
    if (hit.variant_id) {
      return buildMatched(raw, concept, hit.variant_id);
    }
    // Alias pointed at the concept; apply modifier rules
    if (raw.modifier) {
      const v = findVariantByModifier(variantMap.get(hit.concept_id), raw.modifier);
      if (v) return buildMatched(raw, concept, v.id);
      // No variant match — return concept+default and let auto-create handle it on the second pass
    }
    const def = pickDefaultVariant(variantMap.get(hit.concept_id));
    return buildMatched(raw, concept, def?.id ?? null);
  }

  // Stage 2 — base alias → concept
  const baseHit = aliasMap.get(baseOnly);
  if (!baseHit) return null;
  const concept = {
    id: baseHit.concept_id,
    slug: baseHit.concept_slug,
    legacy_canonical_id: baseHit.legacy_canonical_id,
  };
  if (raw.modifier) {
    const v = findVariantByModifier(variantMap.get(baseHit.concept_id), raw.modifier);
    if (v) return buildMatched(raw, concept, v.id);
    // Modifier is novel — signal to caller by returning null so auto-create kicks in
    return null;
  }
  const def = pickDefaultVariant(variantMap.get(baseHit.concept_id));
  return buildMatched(raw, concept, def?.id ?? null);
}
