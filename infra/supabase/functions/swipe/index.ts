// Swipe Tracking Endpoint
// POST /functions/v1/swipe

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SwipeRequest {
  userId: string;
  dishId: string;
  action: 'left' | 'right' | 'super';
  viewDuration?: number; // milliseconds
  position?: number; // position in feed (1-based)
  sessionId?: string;
  context?: any; // optional context data
}

serve(async req => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: SwipeRequest = await req.json();
    const { userId, dishId, action, viewDuration, position, sessionId, context } = body;

    console.log('[Swipe]', { userId, dishId, action, position });

    // Validate required fields
    if (!userId || !dishId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, dishId, action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['left', 'right', 'super'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be: left, right, or super' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Log swipe to database
    const { error: swipeError } = await supabase.from('user_swipes').insert({
      user_id: userId,
      dish_id: dishId,
      action,
      view_duration: viewDuration || null,
      position_in_feed: position || null,
      session_id: sessionId || null,
      context: context || null,
    });

    if (swipeError) {
      console.error('[Swipe] Insert error:', swipeError);
      throw swipeError;
    }

    // 2. Update dish analytics (async, don't wait)
    updateDishAnalytics(dishId, action).catch(err =>
      console.error('[Swipe] Analytics update error:', err)
    );

    // 3. Update user behavior profile (async, don't wait)
    updateUserBehavior(userId, action).catch(err =>
      console.error('[Swipe] User profile update error:', err)
    );

    // Return success immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Swipe recorded',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Swipe] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Update dish analytics (increment counters)
async function updateDishAnalytics(dishId: string, action: string) {
  // Increment view count
  await supabase.rpc('increment', {
    table_name: 'dish_analytics',
    column_name: 'view_count',
    row_id: dishId,
  });

  // Increment action-specific counter
  if (action === 'right') {
    await supabase.rpc('increment', {
      table_name: 'dish_analytics',
      column_name: 'right_swipe_count',
      row_id: dishId,
    });
  } else if (action === 'left') {
    await supabase.rpc('increment', {
      table_name: 'dish_analytics',
      column_name: 'left_swipe_count',
      row_id: dishId,
    });
  } else if (action === 'super') {
    await supabase.rpc('increment', {
      table_name: 'dish_analytics',
      column_name: 'super_like_count',
      row_id: dishId,
    });
  }
}

// Update user behavior profile
async function updateUserBehavior(userId: string, action: string) {
  // Get current profile
  const { data: profile } = await supabase
    .from('user_behavior_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    // Create new profile
    await supabase.from('user_behavior_profiles').insert({
      user_id: userId,
      total_swipes: 1,
      right_swipes: action === 'right' || action === 'super' ? 1 : 0,
      left_swipes: action === 'left' ? 1 : 0,
    });
  } else {
    // Update existing profile
    await supabase
      .from('user_behavior_profiles')
      .update({
        total_swipes: profile.total_swipes + 1,
        right_swipes:
          action === 'right' || action === 'super'
            ? profile.right_swipes + 1
            : profile.right_swipes,
        left_swipes: action === 'left' ? profile.left_swipes + 1 : profile.left_swipes,
        last_active_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }
}
