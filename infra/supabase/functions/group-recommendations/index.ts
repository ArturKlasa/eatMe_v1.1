/**
 * Group Recommendations Edge Function
 *
 * Generates restaurant recommendations for Eat Together sessions
 * by analyzing all members' preferences and locations
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Member {
  user_id: string;
  current_location: { lat: number; lng: number } | null;
  profile_name: string;
  preferences: {
    diet_preference: 'all' | 'vegetarian' | 'vegan';
    allergies: Record<string, boolean>;
    exclude: Record<string, boolean>;
    religious_restrictions: Record<string, boolean>;
  };
}

interface Restaurant {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  cuisine_types: string[];
  price_level: number;
  rating: number;
  address: string;
  phone: string;
  distance: number;
}

serve(async req => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, locationMode, radiusKm = 5 } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Verify user is session host
    const { data: session, error: sessionError } = await supabaseClient
      .from('eat_together_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('host_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found or unauthorized' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get all active members with their preferences and locations
    const { data: membersData, error: membersError } = await supabaseClient
      .from('eat_together_members')
      .select(
        `
        user_id,
        current_location,
        is_host,
        users!inner(profile_name)
      `
      )
      .eq('session_id', sessionId)
      .is('left_at', null);

    if (membersError) {
      throw membersError;
    }

    if (!membersData || membersData.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Need at least 2 members to generate recommendations' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Fetch preferences for all members
    const memberIds = membersData.map(m => m.user_id);
    const { data: preferencesData } = await supabaseClient
      .from('user_preferences')
      .select('*')
      .in('user_id', memberIds);

    const preferencesMap = new Map(preferencesData?.map(p => [p.user_id, p]) || []);

    // 4. Build members array with all data
    const members: Member[] = membersData.map(m => ({
      user_id: m.user_id,
      current_location: m.current_location ? parseLocation(m.current_location) : null,
      profile_name: (m.users as any).profile_name || 'Unknown',
      preferences: preferencesMap.get(m.user_id) || getDefaultPreferences(),
    }));

    // 5. Calculate search center based on location mode
    const searchCenter = calculateSearchCenter(members, locationMode);

    if (!searchCenter) {
      return new Response(
        JSON.stringify({
          error: 'Unable to determine search location. Members need to share their location.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Find restaurants within radius
    const { data: restaurants, error: restaurantsError } = await supabaseClient.rpc(
      'nearby_restaurants',
      {
        lat: searchCenter.lat,
        lng: searchCenter.lng,
        radius_km: radiusKm,
      }
    );

    if (restaurantsError) {
      throw restaurantsError;
    }

    if (!restaurants || restaurants.length === 0) {
      return new Response(
        JSON.stringify({
          recommendations: [],
          message: 'No restaurants found in the area',
          searchCenter,
          radiusKm,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 7. Score and filter restaurants based on ALL members' requirements
    const scoredRestaurants = restaurants
      .map((restaurant: any) => {
        const score = scoreRestaurant(restaurant, members);
        return {
          ...restaurant,
          ...score,
        };
      })
      .filter(r => r.satisfiesHardConstraints)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 5); // Top 5 for voting

    // 8. Save recommendations to database
    if (scoredRestaurants.length > 0) {
      const recommendationsToInsert = scoredRestaurants.map(r => ({
        session_id: sessionId,
        restaurant_id: r.id,
        compatibility_score: r.compatibilityScore,
        distance_from_center: r.distance,
        members_satisfied: r.membersSatisfied,
        total_members: members.length,
        dietary_compatibility: r.dietaryCompatibility,
      }));

      // Clear old recommendations first
      await supabaseClient
        .from('eat_together_recommendations')
        .delete()
        .eq('session_id', sessionId);

      await supabaseClient.from('eat_together_recommendations').insert(recommendationsToInsert);

      // Update session status
      await supabaseClient
        .from('eat_together_sessions')
        .update({ status: 'voting' })
        .eq('id', sessionId);
    }

    return new Response(
      JSON.stringify({
        recommendations: scoredRestaurants,
        metadata: {
          searchCenter,
          radiusKm,
          totalMembers: members.length,
          totalRestaurants: restaurants.length,
          filteredRestaurants: scoredRestaurants.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in group-recommendations:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper Functions

function parseLocation(location: any): { lat: number; lng: number } | null {
  if (!location) return null;

  if (typeof location === 'object' && location.lat && location.lng) {
    return { lat: location.lat, lng: location.lng };
  }

  if (typeof location === 'string' && location.startsWith('POINT')) {
    const match = location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
    if (match) {
      return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
    }
  }

  return null;
}

function getDefaultPreferences() {
  return {
    diet_preference: 'all' as const,
    allergies: {},
    exclude: {},
    religious_restrictions: {},
  };
}

function calculateSearchCenter(
  members: Member[],
  locationMode: string
): { lat: number; lng: number } | null {
  const locationsAvailable = members.filter(m => m.current_location);

  if (locationsAvailable.length === 0) return null;

  if (locationMode === 'host_location') {
    const host = members.find(m => m.current_location);
    return host?.current_location || null;
  }

  if (locationMode === 'midpoint') {
    const avgLat =
      locationsAvailable.reduce((sum, m) => sum + m.current_location!.lat, 0) /
      locationsAvailable.length;
    const avgLng =
      locationsAvailable.reduce((sum, m) => sum + m.current_location!.lng, 0) /
      locationsAvailable.length;
    return { lat: avgLat, lng: avgLng };
  }

  // max_radius - use midpoint (implementation could be enhanced)
  const avgLat =
    locationsAvailable.reduce((sum, m) => sum + m.current_location!.lat, 0) /
    locationsAvailable.length;
  const avgLng =
    locationsAvailable.reduce((sum, m) => sum + m.current_location!.lng, 0) /
    locationsAvailable.length;
  return { lat: avgLat, lng: avgLng };
}

function scoreRestaurant(restaurant: any, members: Member[]) {
  let compatibilityScore = 100;
  let membersSatisfied = 0;
  const dietaryCompatibility: Record<string, any> = {};
  let satisfiesHardConstraints = true;

  // Check HARD CONSTRAINTS - ALL members must be satisfied
  for (const member of members) {
    const memberResult = checkMemberCompatibility(restaurant, member);
    dietaryCompatibility[member.profile_name] = memberResult;

    if (!memberResult.satisfiesHardConstraints) {
      satisfiesHardConstraints = false;
      break; // Restaurant fails if ANY member's hard constraints aren't met
    }

    if (memberResult.compatible) {
      membersSatisfied++;
      compatibilityScore += memberResult.score;
    }
  }

  // Average the score
  compatibilityScore = Math.round(compatibilityScore / members.length);

  // Boost by restaurant rating
  compatibilityScore += Math.round((restaurant.rating || 4.0) * 10);

  return {
    compatibilityScore,
    membersSatisfied,
    dietaryCompatibility,
    satisfiesHardConstraints,
  };
}

function checkMemberCompatibility(restaurant: any, member: Member) {
  let score = 0;
  let compatible = true;
  let satisfiesHardConstraints = true;
  const issues: string[] = [];

  const prefs = member.preferences;

  // HARD CONSTRAINTS - Must satisfy ALL

  // 1. Vegan/Vegetarian requirements
  if (prefs.diet_preference === 'vegan') {
    // Check if restaurant has vegan options (simplified - would need menu data)
    if (!restaurant.cuisine_types?.includes('vegan')) {
      satisfiesHardConstraints = false;
      issues.push('No vegan options');
    }
  } else if (prefs.diet_preference === 'vegetarian') {
    if (!restaurant.cuisine_types?.includes('vegetarian')) {
      satisfiesHardConstraints = false;
      issues.push('No vegetarian options');
    }
  }

  // 2. Allergies - HARD CONSTRAINT
  // (Simplified - would need detailed menu allergen info)

  // 3. Religious restrictions - HARD CONSTRAINT
  if (prefs.religious_restrictions?.halal && !restaurant.cuisine_types?.includes('halal')) {
    satisfiesHardConstraints = false;
    issues.push('Not halal certified');
  }

  // SOFT PREFERENCES - Score but don't exclude

  // Cuisine preference matching
  // (Would need user cuisine preferences to implement)

  return {
    compatible: satisfiesHardConstraints,
    satisfiesHardConstraints,
    score,
    issues,
  };
}
