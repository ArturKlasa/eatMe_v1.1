// Supabase Edge Function: app-config
// Purpose: Serve the single-row public app_config table so the mobile app can
// check version floors on startup (the Phase 6 force-upgrade gate).
//
// Anonymous-readable: the mobile app calls this BEFORE sign-in. The RLS
// SELECT-public policy on public.app_config (migration 141a) handles the
// authz. This function exists only to (a) provide a stable URL with CORS
// headers and (b) set a long Cache-Control so version checks don't hit the
// DB on every cold start.
//
// Cache-Control: public, max-age=3600 — the floor changes rarely (typically
// after a release campaign). The mobile client also caches the last
// successful response in AsyncStorage so offline boot still has a value.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface AppConfig {
  min_supported_mobile_version: string;
  latest_mobile_version: string;
  update_url_ios: string;
  update_url_android: string;
  updated_at: string;
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('app_config')
      .select(
        'min_supported_mobile_version, latest_mobile_version, update_url_ios, update_url_android, updated_at'
      )
      .limit(1)
      .single();

    if (error || !data) {
      console.error('[app-config] failed to fetch row', error);
      return new Response(JSON.stringify({ error: error?.message ?? 'app_config row not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = data as AppConfig;
    return new Response(JSON.stringify(config), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[app-config] unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
