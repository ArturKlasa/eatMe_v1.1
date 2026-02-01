/**
 * Group Recommendations Edge Function v2
 *
 * Generates restaurant recommendations for Eat Together sessions
 * by analyzing all members' preferences and locations
 *
 * Improvements:
 * - Sophisticated multi-factor scoring algorithm
 * - Better cuisine preference matching
 * - Edge case handling (no results, conflicting restrictions)
 * - Distance-based scoring
 * - Price level consensus
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
    cuisine_preferences?: string[];
    default_price_range?: { min: number; max: number };
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
        const score = scoreRestaurant(restaurant, members, searchCenter);
        return {
          ...restaurant,
          ...score,
        };
      })
      .filter(r => r.satisfiesHardConstraints)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 5); // Top 5 for voting

    // 8. Handle edge cases
    if (scoredRestaurants.length === 0) {
      // Try expanding radius
      const expandedRadius = radiusKm * 2;
      const { data: moreRestaurants } = await supabaseClient.rpc('nearby_restaurants', {
        lat: searchCenter.lat,
        lng: searchCenter.lng,
        radius_km: expandedRadius,
      });

      if (moreRestaurants && moreRestaurants.length > 0) {
        const rescored = moreRestaurants
          .map((restaurant: any) => {
            const score = scoreRestaurant(restaurant, members, searchCenter);
            return { ...restaurant, ...score };
          })
          .filter(r => r.satisfiesHardConstraints)
          .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
          .slice(0, 5);

        if (rescored.length > 0) {
          scoredRestaurants.push(...rescored);
        }
      }

      // Still no results - return helpful error
      if (scoredRestaurants.length === 0) {
        const conflicts = analyzeRestrictionConflicts(members);
        return new Response(
          JSON.stringify({
            recommendations: [],
            message: 'No restaurants found that satisfy all group requirements',
            searchCenter,
            radiusKm,
            expandedRadius,
            conflicts,
            suggestions: generateSuggestions(members, conflicts),
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 9. Save recommendations to database
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

function scoreRestaurant(restaurant: any, members: Member[], searchCenter: { lat: number; lng: number }) {
  let compatibilityScore = 0;
  let membersSatisfied = 0;
  const dietaryCompatibility: Record<string, any> = {};
  let satisfiesHardConstraints = true;

  // STEP 1: Check HARD CONSTRAINTS - ALL members must be satisfied
  for (const member of members) {
    const memberResult = checkMemberCompatibility(restaurant, member);
    dietaryCompatibility[member.profile_name] = memberResult;

    if (!memberResult.satisfiesHardConstraints) {
      satisfiesHardConstraints = false;
      break; // Restaurant fails if ANY member's hard constraints aren't met
    }

    if (memberResult.compatible) {
      membersSatisfied++;
    }
    compatibilityScore += memberResult.score;
  }

  if (!satisfiesHardConstraints) {
    return {
      compatibilityScore: 0,
      membersSatisfied: 0,
      dietaryCompatibility,
      satisfiesHardConstraints: false,
    };
  }

  // STEP 2: Calculate average member satisfaction score
  compatibilityScore = Math.round(compatibilityScore / members.length);

  // STEP 3: Restaurant quality bonus (0-50 points)
  const ratingBonus = Math.round((restaurant.rating || 4.0) * 10);
  compatibilityScore += ratingBonus;

  // STEP 4: Distance penalty/bonus (0-20 points)
  // Closer is better, but within reason
  const distanceKm = restaurant.distance || 0;
  let distanceScore = 0;
  if (distanceKm < 1) {
    distanceScore = 20; // Very close
  } else if (distanceKm < 2) {
    distanceScore = 15;
  } else if (distanceKm < 3) {
    distanceScore = 10;
  } else if (distanceKm < 5) {
    distanceScore = 5;
  }
  compatibilityScore += distanceScore;

  // STEP 5: Cuisine preference bonus (0-30 points)
  const cuisineScore = calculateCuisineScore(restaurant, members);
  compatibilityScore += cuisineScore;

  // STEP 6: Price consensus (0-10 points)
  const priceScore = calculatePriceScore(restaurant, members);
  compatibilityScore += priceScore;

  return {
    compatibilityScore,
    membersSatisfied,
    dietaryCompatibility,
    satisfiesHardConstraints,
    breakdown: {
      baseScore: Math.round(compatibilityScore - ratingBonus - distanceScore - cuisineScore - priceScore),
      ratingBonus,
      distanceScore,
      cuisineScore,
      priceScore,
    },
  };
}

function calculateCuisineScore(restaurant: any, members: Member[]): number {
  if (!restaurant.cuisine_types || restaurant.cuisine_types.length === 0) {
    return 0;
  }

  let score = 0;
  const restaurantCuisines = restaurant.cuisine_types.map((c: string) => c.toLowerCase());

  // Count how many members have this restaurant's cuisine in their preferences
  for (const member of members) {
    const memberCuisines = (member.preferences.cuisine_preferences || []).map(c => c.toLowerCase());
    
    if (memberCuisines.length === 0) {
      // No preferences = slightly positive (neutral)
      score += 5;
      continue;
    }

    // Check for overlap
    const hasMatch = restaurantCuisines.some(rc => memberCuisines.some(mc => 
      rc.includes(mc) || mc.includes(rc)
    ));

    if (hasMatch) {
      score += 10; // Member's preferred cuisine!
    } else {
      score += 2; // Not preferred, but acceptable
    }
  }

  return Math.min(30, Math.round(score / members.length));
}

function calculatePriceScore(restaurant: any, members: Member[]): number {
  if (!restaurant.price_level) return 5; // Neutral if no price info

  const restaurantPrice = restaurant.price_level;
  let totalDeviation = 0;
  let membersWithPrefs = 0;

  for (const member of members) {
    const priceRange = member.preferences.default_price_range;
    if (!priceRange) continue;

    membersWithPrefs++;

    // Check if restaurant price is within member's range
    if (restaurantPrice >= priceRange.min && restaurantPrice <= priceRange.max) {
      totalDeviation += 0; // Perfect match
    } else if (restaurantPrice < priceRange.min) {
      totalDeviation += (priceRange.min - restaurantPrice);
    } else {
      totalDeviation += (restaurantPrice - priceRange.max);
    }
  }

  if (membersWithPrefs === 0) return 5; // No preferences = neutral

  const avgDeviation = totalDeviation / membersWithPrefs;
  
  // Convert deviation to score (0 deviation = 10 points, max deviation = 0 points)
  if (avgDeviation === 0) return 10;
  if (avgDeviation >= 2) return 0;
  
  return Math.round(10 * (1 - avgDeviation / 2));
}

function checkMemberCompatibility(restaurant: any, member: Member) {
  let score = 50; // Base score
  let compatible = true;
  let satisfiesHardConstraints = true;
  const issues: string[] = [];

  const prefs = member.preferences;

  // HARD CONSTRAINTS - Must satisfy ALL

  // 1. Diet preference (Vegan/Vegetarian)
  if (prefs.diet_preference === 'vegan') {
    // Check if restaurant has vegan-friendly indicators
    const cuisines = (restaurant.cuisine_types || []).map((c: string) => c.toLowerCase());
    const hasVeganOptions = cuisines.some((c: string) => 
      c.includes('vegan') || c.includes('vegetarian') || c.includes('plant')
    );
    
    if (!hasVeganOptions && !restaurant.has_vegan_options) {
      satisfiesHardConstraints = false;
      issues.push('No vegan options available');
    } else {
      score += 20; // Bonus for meeting vegan requirement
    }
  } else if (prefs.diet_preference === 'vegetarian') {
    const cuisines = (restaurant.cuisine_types || []).map((c: string) => c.toLowerCase());
    const hasVegetarianOptions = cuisines.some((c: string) => 
      c.includes('vegetarian') || c.includes('vegan') || c.includes('plant')
    );
    
    if (!hasVegetarianOptions && !restaurant.has_vegetarian_options) {
      // Less strict than vegan - most restaurants have at least one veggie option
      score -= 20; // Penalty but not hard fail
      issues.push('Limited vegetarian options');
    } else {
      score += 15;
    }
  }

  // 2. Religious restrictions - HARD CONSTRAINT
  if (prefs.religious_restrictions) {
    if (prefs.religious_restrictions.halal) {
      const cuisines = (restaurant.cuisine_types || []).map((c: string) => c.toLowerCase());
      const isHalal = cuisines.some((c: string) => c.includes('halal')) || restaurant.is_halal_certified;
      
      if (!isHalal) {
        satisfiesHardConstraints = false;
        issues.push('Not halal certified');
      } else {
        score += 20;
      }
    }

    if (prefs.religious_restrictions.kosher) {
      const isKosher = restaurant.is_kosher_certified || 
        (restaurant.cuisine_types || []).some((c: string) => c.toLowerCase().includes('kosher'));
      
      if (!isKosher) {
        satisfiesHardConstraints = false;
        issues.push('Not kosher certified');
      } else {
        score += 20;
      }
    }
  }

  // 3. Allergies - HARD CONSTRAINT (simplified - would need menu allergen data)
  if (prefs.allergies) {
    // Check for critical allergens
    const criticalAllergies = Object.entries(prefs.allergies)
      .filter(([_, enabled]) => enabled)
      .map(([allergen]) => allergen);

    if (criticalAllergies.length > 0) {
      // For now, just warn - would need detailed menu data
      issues.push(`Allergies: ${criticalAllergies.join(', ')} - verify with restaurant`);
      score -= 5; // Small penalty for requiring extra verification
    }
  }

  // 4. Dietary exclusions - HARD CONSTRAINT
  if (prefs.exclude) {
    if (prefs.exclude.noMeat) {
      const cuisines = (restaurant.cuisine_types || []).map((c: string) => c.toLowerCase());
      const isMeatFocused = cuisines.some((c: string) => 
        c.includes('steakhouse') || c.includes('bbq') || c.includes('grill')
      );
      
      if (isMeatFocused) {
        satisfiesHardConstraints = false;
        issues.push('Meat-focused menu');
      }
    }
    
    if (prefs.exclude.noSeafood) {
      const cuisines = (restaurant.cuisine_types || []).map((c: string) => c.toLowerCase());
      const isSeafoodFocused = cuisines.some((c: string) => 
        c.includes('seafood') || c.includes('sushi') || c.includes('fish')
      );
      
      if (isSeafoodFocused) {
        satisfiesHardConstraints = false;
        issues.push('Seafood-focused menu');
      }
    }
  }

  return {
    compatible: satisfiesHardConstraints && score > 30,
    satisfiesHardConstraints,
    score: Math.max(0, Math.min(100, score)),
    issues,
  };
}

function analyzeRestrictionConflicts(members: Member[]) {
  const conflicts: string[] = [];
  
  // Check for impossible diet combinations
  const veganCount = members.filter(m => m.preferences.diet_preference === 'vegan').length;
  const allRestrictionsCount = members.filter(m => {
    const prefs = m.preferences;
    return prefs.religious_restrictions?.halal || prefs.religious_restrictions?.kosher ||
           prefs.exclude?.noMeat || prefs.exclude?.noSeafood;
  }).length;

  if (veganCount > 0 && veganCount === members.length) {
    conflicts.push('All members are vegan - very limited restaurant options');
  }

  if (allRestrictionsCount > members.length * 0.7) {
    conflicts.push('Multiple dietary restrictions make it difficult to find suitable restaurants');
  }

  // Check for conflicting preferences
  const halalRequired = members.some(m => m.preferences.religious_restrictions?.halal);
  const kosherRequired = members.some(m => m.preferences.religious_restrictions?.kosher);
  
  if (halalRequired && kosherRequired) {
    conflicts.push('Both halal and kosher certification required - very rare combination');
  }

  return conflicts;
}

function generateSuggestions(members: Member[], conflicts: string[]) {
  const suggestions: string[] = [];

  if (conflicts.length > 0) {
    suggestions.push('Consider expanding search radius');
    suggestions.push('Try selecting a different meeting location');
    
    const restrictiveMembers = members.filter(m => 
      m.preferences.diet_preference !== 'all' ||
      Object.values(m.preferences.religious_restrictions || {}).some(v => v) ||
      Object.values(m.preferences.exclude || {}).some(v => v)
    );

    if (restrictiveMembers.length > members.length / 2) {
      suggestions.push(`${restrictiveMembers.length} members have dietary restrictions - consider restaurants specializing in accommodating diverse diets`);
    }
  }

  return suggestions;
}
