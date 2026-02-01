/**
 * Eat Together Service
 * Handles all Eat Together session operations
 */

import { supabase } from '../lib/supabase';

export interface EatTogetherSession {
  id: string;
  host_id: string;
  session_code: string;
  status: 'waiting' | 'recommending' | 'voting' | 'decided' | 'cancelled' | 'expired';
  location_mode: 'host_location' | 'midpoint' | 'max_radius';
  selected_restaurant_id: string | null;
  created_at: string;
  expires_at: string;
  closed_at: string | null;
}

export interface SessionMember {
  id: string;
  session_id: string;
  user_id: string;
  is_host: boolean;
  current_location: { lat: number; lng: number } | null;
  joined_at: string;
  left_at: string | null;
  profile_name?: string;
}

export interface RestaurantRecommendation {
  id: string;
  session_id: string;
  restaurant_id: string;
  compatibility_score: number;
  distance_from_center: number;
  members_satisfied: number;
  total_members: number;
  dietary_compatibility: any;
  restaurant?: any; // Full restaurant details
}

export interface Vote {
  id: string;
  session_id: string;
  user_id: string;
  restaurant_id: string;
  created_at: string;
}

/**
 * Create a new Eat Together session
 */
export async function createSession(
  userId: string,
  locationMode: 'host_location' | 'midpoint' | 'max_radius' = 'host_location'
): Promise<{ data: EatTogetherSession | null; error: Error | null }> {
  try {
    // Generate unique session code
    const { data: codeData, error: codeError } = await supabase.rpc('generate_session_code');

    if (codeError) {
      return { data: null, error: new Error(codeError.message) };
    }

    const sessionCode = codeData as string;

    // Create session
    const { data, error } = await supabase
      .from('eat_together_sessions')
      .insert({
        host_id: userId,
        session_code: sessionCode,
        location_mode: locationMode,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Add host as first member
    await supabase.from('eat_together_members').insert({
      session_id: data.id,
      user_id: userId,
      is_host: true,
    });

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Join an existing session by code
 */
export async function joinSession(
  userId: string,
  sessionCode: string,
  location?: { lat: number; lng: number }
): Promise<{ data: EatTogetherSession | null; error: Error | null }> {
  try {
    // Find session by code
    const { data: session, error: sessionError } = await supabase
      .from('eat_together_sessions')
      .select('*')
      .eq('session_code', sessionCode.toUpperCase())
      .eq('status', 'waiting')
      .single();

    if (sessionError || !session) {
      return { data: null, error: new Error('Session not found or already started') };
    }

    // Check if user already in session
    const { data: existing } = await supabase
      .from('eat_together_members')
      .select('*')
      .eq('session_id', session.id)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    if (existing) {
      return { data: session, error: null }; // Already joined
    }

    // Add member to session
    const locationPoint = location ? `POINT(${location.lng} ${location.lat})` : null;

    const { error: memberError } = await supabase.from('eat_together_members').insert({
      session_id: session.id,
      user_id: userId,
      is_host: false,
      current_location: locationPoint,
    });

    if (memberError) {
      return { data: null, error: new Error(memberError.message) };
    }

    return { data: session, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get session by ID with members
 */
export async function getSession(
  sessionId: string
): Promise<{ data: EatTogetherSession | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('eat_together_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get session members
 */
export async function getSessionMembers(
  sessionId: string
): Promise<{ data: SessionMember[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('eat_together_members')
      .select(
        `
        *,
        users!inner(profile_name)
      `
      )
      .eq('session_id', sessionId)
      .is('left_at', null)
      .order('joined_at', { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Parse the data to include profile_name
    const members = data.map((m: any) => ({
      ...m,
      profile_name: m.users?.profile_name || 'Unknown',
    }));

    return { data: members, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update member location
 */
export async function updateMemberLocation(
  sessionId: string,
  userId: string,
  location: { lat: number; lng: number }
): Promise<{ error: Error | null }> {
  try {
    const locationPoint = `POINT(${location.lng} ${location.lat})`;

    const { error } = await supabase
      .from('eat_together_members')
      .update({ current_location: locationPoint })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Leave session
 */
export async function leaveSession(
  sessionId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('eat_together_members')
      .update({ left_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Close session (host only)
 */
export async function closeSession(sessionId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('eat_together_sessions')
      .update({
        status: 'cancelled',
        closed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Get recommendations for voting
 */
export async function getRecommendations(
  sessionId: string
): Promise<{ data: RestaurantRecommendation[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('eat_together_recommendations')
      .select(
        `
        *,
        restaurants(*)
      `
      )
      .eq('session_id', sessionId)
      .order('compatibility_score', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Submit vote
 */
export async function submitVote(
  sessionId: string,
  userId: string,
  restaurantId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('eat_together_votes').upsert(
      {
        session_id: sessionId,
        user_id: userId,
        restaurant_id: restaurantId,
      },
      {
        onConflict: 'session_id,user_id',
      }
    );

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Get vote results
 */
export async function getVoteResults(
  sessionId: string
): Promise<{ data: any[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_vote_results', {
      p_session_id: sessionId,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get all votes for a session
 */
export async function getVotes(
  sessionId: string
): Promise<{ data: Vote[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('eat_together_votes')
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Finalize restaurant selection (host only)
 */
export async function finalizeSelection(
  sessionId: string,
  restaurantId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('eat_together_sessions')
      .update({
        status: 'decided',
        selected_restaurant_id: restaurantId,
      })
      .eq('id', sessionId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Search users by profile name
 */
export async function searchUsersByProfileName(
  searchQuery: string
): Promise<{ data: any[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, profile_name, email')
      .ilike('profile_name', `%${searchQuery}%`)
      .limit(10);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Invite user to session (host only)
 */
export async function inviteUserToSession(
  sessionId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    // Check if user already in session
    const { data: existing } = await supabase
      .from('eat_together_members')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    if (existing) {
      return { error: new Error('User already in session') };
    }

    const { error } = await supabase.from('eat_together_members').insert({
      session_id: sessionId,
      user_id: userId,
      is_host: false,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Subscribe to session changes (Realtime)
 */
export function subscribeToSession(
  sessionId: string,
  onSessionChange: (session: EatTogetherSession) => void,
  onMembersChange: (members: SessionMember[]) => void
) {
  const sessionChannel = supabase
    .channel(`session-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'eat_together_sessions',
        filter: `id=eq.${sessionId}`,
      },
      payload => {
        onSessionChange(payload.new as EatTogetherSession);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'eat_together_members',
        filter: `session_id=eq.${sessionId}`,
      },
      async () => {
        // Refetch members when changes occur
        const { data } = await getSessionMembers(sessionId);
        if (data) {
          onMembersChange(data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(sessionChannel);
  };
}

// Export alias for getSession as getSessionDetails for backward compatibility
export const getSessionDetails = getSession;
