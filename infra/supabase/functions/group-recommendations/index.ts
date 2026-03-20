/**
 * group-recommendations/index.ts
 * Phase 7: Group Recommendations V2
 *
 * Changes from V1:
 * - Hard constraints are now unioned across ALL members and applied at the
 *   DISH level via get_group_candidates() RPC (not heuristic cuisine-name checks)
 * - Preferences use TEXT[] format (Phase 1 migration) not JSONB boolean maps
 * - Vector-based group scoring: group_vector = average of member preference_vectors
 *   scored against restaurants.restaurant_vector via cosine distance
 * - Hybrid final score: 0.4 * vector_sim + 0.3 * cuisine_compat + 0.2 * distance + 0.1 * rating
 * - Fallback: when no members have preference vectors, pure label-based scoring
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DIMS = 1536;

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupMember {
  user_id: string;
  profile_name: string;
  current_location: { lat: number; lng: number } | null;
  preferences: {
    diet_preference: 'all' | 'vegetarian' | 'vegan';
    allergies: string[];
    exclude: string[];
    religious_restrictions: string[];
  };
  preference_vector: number[] | null;
}

interface Candidate {
  id: string;
  name: string;
  cuisine_types: string[];
  rating: number;
  address: string;
  phone: string;
  location: Record<string, unknown>;
  distance_m: number;
  restaurant_vector: number[] | null;
  vector_distance: number | null;
  score?: number;
  compatibilityScore?: number;
  vectorSimilarity?: number | null;
  breakdown?: Record<string, number>;
}

// ── Vector helpers ────────────────────────────────────────────────────────────

function parseVector(raw: unknown): number[] | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (Array.isArray(raw)) return raw as number[];
  return null;
}

/**
 * Compute group preference vector = unweighted average of all non-null member vectors.
 * Members with no vector are excluded (not diluted with zeros).
 */
function computeGroupVector(members: GroupMember[]): number[] | null {
  const vectorMembers = members.filter(m => m.preference_vector !== null);
  if (vectorMembers.length === 0) return null;

  const acc = new Float64Array(DIMS);
  for (const m of vectorMembers) {
    for (let i = 0; i < DIMS; i++) acc[i] += m.preference_vector![i];
  }
  const result = new Array<number>(DIMS);
  for (let i = 0; i < DIMS; i++) result[i] = acc[i] / vectorMembers.length;
  return result;
}

// ── Group constraints (union) ─────────────────────────────────────────────────

const DIET_ORDER: Record<string, number> = { all: 0, vegetarian: 1, vegan: 2 };

interface GroupConstraints {
  diet: 'all' | 'vegetarian' | 'vegan';
  allergens: string[];
  religious: string[];
}

function computeGroupConstraints(members: GroupMember[]): GroupConstraints {
  const diet = members.reduce<'all' | 'vegetarian' | 'vegan'>((strictest, m) => {
    const d = m.preferences.diet_preference ?? 'all';
    return DIET_ORDER[d] > DIET_ORDER[strictest] ? d : strictest;
  }, 'all');

  const allergens = [...new Set(members.flatMap(m => m.preferences.allergies ?? []))];
  const religious = [...new Set(members.flatMap(m => m.preferences.religious_restrictions ?? []))];

  return { diet, allergens, religious };
}

// ── Stage 2: scoring ──────────────────────────────────────────────────────────

function scoreCandidate(
  r: Candidate,
  groupVector: number[] | null,
  members: GroupMember[],
  radiusKm: number
): Candidate {
  const distNorm   = Math.max(0, 1 - (r.distance_m / 1000) / radiusKm);
  const ratingNorm = (r.rating ?? 0) / 5;

  // Cuisine compatibility: fraction of members whose preferred_cuisines
  // overlap with this restaurant (soft signal only — vector covers the rest).
  // Without per-member cuisine prefs here, use neutral 0.5.
  const cuisineNorm = 0.5;

  const vectorSim =
    groupVector !== null && r.vector_distance !== null
      ? Math.max(0, 1 - r.vector_distance)
      : null;

  let score: number;
  if (vectorSim !== null) {
    score = 0.4 * vectorSim + 0.3 * cuisineNorm + 0.2 * distNorm + 0.1 * ratingNorm;
  } else {
    // Cold start fallback
    score = 0.4 * cuisineNorm + 0.35 * ratingNorm + 0.25 * distNorm;
  }

  return {
    ...r,
    score,
    compatibilityScore: Math.round(score * 100),
    vectorSimilarity: vectorSim,
    breakdown: {
      vectorSimilarity:    vectorSim !== null ? Math.round(vectorSim * 100) : 0,
      cuisineCompatibility: Math.round(cuisineNorm * 100),
      distanceScore:       Math.round(distNorm * 100),
      ratingScore:         Math.round(ratingNorm * 100),
    },
  };
}

// ── Location helpers ──────────────────────────────────────────────────────────

function parseLocation(raw: unknown): { lat: number; lng: number } | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.lat === 'number' && typeof obj.lng === 'number')
      return { lat: obj.lat, lng: obj.lng };
  }
  if (typeof raw === 'string' && raw.startsWith('POINT')) {
    const m = raw.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (m) return { lat: parseFloat(m[2]), lng: parseFloat(m[1]) };
  }
  return null;
}

function calculateSearchCenter(
  members: GroupMember[],
  locationMode: string
): { lat: number; lng: number } | null {
  const located = members.filter(m => m.current_location !== null);
  if (located.length === 0) return null;
  if (locationMode === 'host_location') return located[0].current_location!;
  const avgLat = located.reduce((s, m) => s + m.current_location!.lat, 0) / located.length;
  const avgLng = located.reduce((s, m) => s + m.current_location!.lng, 0) / located.length;
  return { lat: avgLat, lng: avgLng };
}

function analyzeConflicts(members: GroupMember[], constraints: GroupConstraints): string[] {
  const conflicts: string[] = [];
  if (constraints.diet === 'vegan')
    conflicts.push('All-vegan filter active — limited restaurant options');
  if (constraints.allergens.length >= 4)
    conflicts.push(`${constraints.allergens.length} allergens must be avoided — complex filter`);
  if (constraints.religious.includes('halal') && constraints.religious.includes('kosher'))
    conflicts.push('Both halal and kosher required — extremely rare combination');
  return conflicts;
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, locationMode = 'midpoint', radiusKm = 5 } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Verify session + host
    const { data: session, error: sessionError } = await supabaseClient
      .from('eat_together_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found or unauthorized' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Load session members
    const { data: membersData, error: membersError } = await supabaseClient
      .from('eat_together_members')
      .select('user_id, current_location, is_host, users!inner(profile_name)')
      .eq('session_id', sessionId)
      .is('left_at', null);

    if (membersError) throw membersError;
    if (!membersData || membersData.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Need at least 2 active members to generate recommendations' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const memberIds = membersData.map(m => m.user_id);

    // 3. Load preferences + behavior profiles (parallel)
    const [prefsRes, behaviorRes] = await Promise.all([
      serviceClient
        .from('user_preferences')
        .select('user_id, diet_preference, allergies, exclude, religious_restrictions')
        .in('user_id', memberIds),
      serviceClient
        .from('user_behavior_profiles')
        .select('user_id, preference_vector')
        .in('user_id', memberIds),
    ]);

    const prefsMap  = new Map((prefsRes.data   ?? []).map((p: any) => [p.user_id, p]));
    const vectorMap = new Map((behaviorRes.data ?? []).map((b: any) => [b.user_id, b]));

    // 4. Build GroupMember array
    const members: GroupMember[] = membersData.map(m => {
      const prefs = prefsMap.get(m.user_id) as any;
      const beh   = vectorMap.get(m.user_id) as any;
      return {
        user_id:          m.user_id,
        profile_name:     (m.users as any).profile_name ?? 'Unknown',
        current_location: parseLocation(m.current_location),
        preferences: {
          diet_preference:       prefs?.diet_preference       ?? 'all',
          allergies:             prefs?.allergies              ?? [],
          exclude:               prefs?.exclude                ?? [],
          religious_restrictions: prefs?.religious_restrictions ?? [],
        },
        preference_vector: parseVector(beh?.preference_vector),
      };
    });

    console.log(`[GroupRec] ${members.length} members, session ${sessionId}`);

    // 5. Search centre
    const searchCenter = calculateSearchCenter(members, locationMode);
    if (!searchCenter) {
      return new Response(
        JSON.stringify({ error: 'Unable to determine search location — members must share location' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Compute group constraints (union) + group vector (average)
    const constraints      = computeGroupConstraints(members);
    const groupVector      = computeGroupVector(members);
    const vectorMemberCount = members.filter(m => m.preference_vector !== null).length;

    console.log(
      `[GroupRec] diet=${constraints.diet}, allergens=[${constraints.allergens}], ` +
      `religious=[${constraints.religious}], vectors=${vectorMemberCount}/${members.length}`
    );

    // 7. Stage 1: get_group_candidates (DB-level hard filter + ANN ordering)
    const candidateParams = {
      p_lat:            searchCenter.lat,
      p_lng:            searchCenter.lng,
      p_radius_m:       radiusKm * 1000,
      p_group_vector:   groupVector ? JSON.stringify(groupVector) : null,
      p_allergens:      constraints.allergens.length ? constraints.allergens : null,
      p_diet_tag:       constraints.diet !== 'all' ? constraints.diet : null,
      p_religious_tags: constraints.religious.length ? constraints.religious : null,
      p_limit:          40,
    };

    let { data: candidates, error: candidateError } = await serviceClient.rpc(
      'get_group_candidates', candidateParams
    );
    if (candidateError) throw candidateError;

    let pool = (candidates ?? []) as Candidate[];
    console.log(`[GroupRec] Stage 1: ${pool.length} candidates`);

    if (pool.length === 0) {
      // Retry with 2× radius
      const { data: expanded } = await serviceClient.rpc('get_group_candidates', {
        ...candidateParams,
        p_radius_m: radiusKm * 2 * 1000,
      });
      pool = (expanded ?? []) as Candidate[];

      if (pool.length === 0) {
        const conflicts = analyzeConflicts(members, constraints);
        return new Response(
          JSON.stringify({
            recommendations: [],
            message: 'No restaurants found satisfying all group requirements',
            searchCenter,
            radiusKm: radiusKm * 2,
            conflicts,
            groupConstraints: constraints,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 8. Stage 2: score + rank → top 5
    const scored = pool
      .map(r => scoreCandidate(r, groupVector, members, radiusKm))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5);

    console.log(`[GroupRec] Returning ${scored.length} recommendations`);

    // 9. Persist + advance session to 'voting'
    if (scored.length > 0) {
      await supabaseClient
        .from('eat_together_recommendations')
        .delete()
        .eq('session_id', sessionId);

      await supabaseClient.from('eat_together_recommendations').insert(
        scored.map(r => ({
          session_id:            sessionId,
          restaurant_id:         r.id,
          compatibility_score:   r.compatibilityScore ?? 0,
          distance_from_center:  r.distance_m / 1000,
          members_satisfied:     members.length,
          total_members:         members.length,
          dietary_compatibility: r.breakdown ?? {},
        }))
      );

      await supabaseClient
        .from('eat_together_sessions')
        .update({ status: 'voting' })
        .eq('id', sessionId);
    }

    return new Response(
      JSON.stringify({
        recommendations: scored,
        metadata: {
          searchCenter,
          radiusKm,
          totalMembers:       members.length,
          vectorMemberCount,
          personalized:       groupVector !== null,
          totalCandidates:    pool.length,
          returned:           scored.length,
          groupConstraints:   constraints,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[GroupRec] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

