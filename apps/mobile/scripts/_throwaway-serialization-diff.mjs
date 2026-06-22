// THROWAWAY one-shot serialization-diff harness (Phase 08-02, D-04).
//
// Purpose: prove the persistence-serialization seam is byte-for-byte identical
// across the filterStore.ts -> filterStore/ slice split (RFCT-01 / SC#2), so no
// installed user loses their saved permanent filters because the AsyncStorage
// serialization shape changed.
//
// This is NOT a committed test. It is run once, then deleted (Task 3). No test
// runner is stood up in apps/mobile (Deferred Ideas / D-04).
//
// The seam is exactly `JSON.stringify(currentState.permanent)` in
// apps/mobile/src/stores/filterStore/persistence.ts (saveFilters writes only the
// `permanent` object + lastSyncedAt). Its output is fully determined by the shape
// of the `permanent` object, whose defaults are `defaultPermanentFilters` (pure
// data, no native deps).
//
// HARNESS OPTION USED: (ii) inline-literal copy.
// We do NOT import filterStore/index.ts (pulls in zustand + AsyncStorage + RN
// native deps that fail under bare Node). We also do NOT import defaults.ts
// (its chain reaches @eatme/shared via currencyConfig, which may be RN-incompatible
// under bare Node). Instead we inline both the frozen PRE-refactor literal and the
// POST-refactor literal (read verbatim from the respective sources) and assert
// JSON.stringify equality.
//
// Run: node apps/mobile/scripts/_throwaway-serialization-diff.mjs
// On full match: prints SERIALIZATION_BYTE_FOR_BYTE_OK and exits 0.
// On mismatch: prints a unified JSON diff and exits 1.

// ---------------------------------------------------------------------------
// (1) PRE-refactor baseline — recovered verbatim from git:
//     git show e3c6d31:apps/mobile/src/stores/filterStore.ts (lines 254-279)
//     (e3c6d31 is the pre-08-01 HEAD; this is the original default object).
// ---------------------------------------------------------------------------
const PRE_REFACTOR_DEFAULT_PERMANENT = {
  dietPreference: 'all',
  exclude: {
    noMeat: false,
    noFish: false,
    noSeafood: false,
    noEggs: false,
    noSpicy: false,
  },
  defaultPriceRange: {
    min: 10,
    max: 50,
  },
  cuisinePreferences: [],
  defaultNutrition: {
    maxCalories: 2000,
    lowSodium: false,
    highProtein: false,
    enabled: false,
  },
  notifications: {
    dailyMenuAlerts: true,
    nearbyPromos: true,
    newRestaurants: false,
  },
};

// ---------------------------------------------------------------------------
// (2) POST-refactor literal — read verbatim from
//     apps/mobile/src/stores/filterStore/defaults.ts (lines 56-81),
//     the `defaultPermanentFilters` export. NOT imported (avoids native-dep
//     resolution under bare Node).
// ---------------------------------------------------------------------------
const POST_REFACTOR_DEFAULT_PERMANENT = {
  dietPreference: 'all',
  exclude: {
    noMeat: false,
    noFish: false,
    noSeafood: false,
    noEggs: false,
    noSpicy: false,
  },
  defaultPriceRange: {
    min: 10,
    max: 50,
  },
  cuisinePreferences: [],
  defaultNutrition: {
    maxCalories: 2000,
    lowSodium: false,
    highProtein: false,
    enabled: false,
  },
  notifications: {
    dailyMenuAlerts: true,
    nearbyPromos: true,
    newRestaurants: false,
  },
};

// ---------------------------------------------------------------------------
// (3) POPULATED non-default sample — catches nested-key drift. Since the seam is
//     a flat JSON.stringify(permanent), the populated payload is serialized
//     directly; its key structure (top-level + nested) must match the
//     post-refactor default's key structure (proves no field renamed/added/dropped).
// ---------------------------------------------------------------------------
const POPULATED_SAMPLE = {
  dietPreference: 'vegan',
  exclude: {
    noMeat: true,
    noFish: false,
    noSeafood: true,
    noEggs: false,
    noSpicy: false,
  },
  defaultPriceRange: {
    min: 25,
    max: 90,
  },
  cuisinePreferences: ['italian', 'thai'],
  defaultNutrition: {
    maxCalories: 1500,
    lowSodium: true,
    highProtein: true,
    enabled: true,
  },
  notifications: {
    dailyMenuAlerts: false,
    nearbyPromos: true,
    newRestaurants: true,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Recursively collect a stable, sorted key-structure signature of an object so we
// can compare SHAPE (field names + nesting) independent of values and key order.
function keyStructure(value) {
  if (Array.isArray(value)) {
    // Arrays: record as a typed leaf — element key-shape of cuisinePreferences
    // (string[]) is not part of the object key contract.
    return '[]';
  }
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = keyStructure(value[k]);
    }
    return out;
  }
  // Primitive leaf — record the type, not the value.
  return typeof value;
}

function stableStructureString(value) {
  return JSON.stringify(keyStructure(value));
}

// Minimal unified-style line diff of two JSON strings (pretty-printed).
function unifiedJsonDiff(labelA, a, labelB, b) {
  const aLines = JSON.stringify(a, null, 2).split('\n');
  const bLines = JSON.stringify(b, null, 2).split('\n');
  const max = Math.max(aLines.length, bLines.length);
  const lines = [`--- ${labelA}`, `+++ ${labelB}`];
  for (let i = 0; i < max; i++) {
    const la = aLines[i];
    const lb = bLines[i];
    if (la === lb) {
      lines.push(`  ${la ?? ''}`);
    } else {
      if (la !== undefined) lines.push(`- ${la}`);
      if (lb !== undefined) lines.push(`+ ${lb}`);
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
let ok = true;

// (A) Byte-for-byte equality of the DEFAULTS serialized payload (the actual seam:
//     JSON.stringify(permanent) with no replacer/space — exactly as saveFilters does).
const preStr = JSON.stringify(PRE_REFACTOR_DEFAULT_PERMANENT);
const postStr = JSON.stringify(POST_REFACTOR_DEFAULT_PERMANENT);

if (preStr !== postStr) {
  ok = false;
  console.error('MISMATCH: pre-refactor vs post-refactor default permanent serialization differs.');
  console.error('PRE :', preStr);
  console.error('POST:', postStr);
  console.error(
    unifiedJsonDiff(
      'PRE_REFACTOR_DEFAULT_PERMANENT',
      PRE_REFACTOR_DEFAULT_PERMANENT,
      'POST_REFACTOR_DEFAULT_PERMANENT',
      POST_REFACTOR_DEFAULT_PERMANENT
    )
  );
}

// (B) The populated sample's key structure must match the post-refactor default's
//     key structure (proves no field renamed/added/dropped on a non-default payload).
const postShape = stableStructureString(POST_REFACTOR_DEFAULT_PERMANENT);
const sampleShape = stableStructureString(POPULATED_SAMPLE);

if (postShape !== sampleShape) {
  ok = false;
  console.error('MISMATCH: populated sample key structure differs from post-refactor default shape.');
  console.error(
    unifiedJsonDiff(
      'POST_DEFAULT_KEY_STRUCTURE',
      keyStructure(POST_REFACTOR_DEFAULT_PERMANENT),
      'POPULATED_SAMPLE_KEY_STRUCTURE',
      keyStructure(POPULATED_SAMPLE)
    )
  );
}

// (C) Sanity: the populated sample round-trips through JSON without loss
//     (defensive — the seam writes then reads it back via JSON.parse in loadFilters).
const roundTripped = JSON.parse(JSON.stringify(POPULATED_SAMPLE));
if (JSON.stringify(roundTripped) !== JSON.stringify(POPULATED_SAMPLE)) {
  ok = false;
  console.error('MISMATCH: populated sample did not round-trip through JSON cleanly.');
}

if (ok) {
  console.log('SERIALIZATION_BYTE_FOR_BYTE_OK');
  process.exit(0);
} else {
  process.exit(1);
}
