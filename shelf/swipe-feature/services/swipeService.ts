/**
 * Swipe Service — SHELVED (March 18, 2026)
 *
 * Contains trackSwipe() and related types extracted from
 * apps/mobile/src/services/edgeFunctionsService.ts when the swipe
 * feature was shelved.
 *
 * getFeed() and ServerDish remain in edgeFunctionsService.ts because
 * BasicMapScreen still uses them for the dish map view.
 *
 * Restore: merge this back into edgeFunctionsService.ts (or import
 * directly from here) when the SwipeScreen gesture layer is complete.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

/**
 * Swipe request parameters
 */
export interface SwipeRequest {
  userId: string;
  dishId: string;
  action: 'left' | 'right' | 'super';
  viewDuration?: number; // milliseconds
  position?: number; // position in feed
  sessionId?: string;
}

/**
 * Track user swipe action
 * Calls the /functions/v1/swipe Edge Function which records to user_swipes table.
 */
export async function trackSwipe(
  userId: string,
  dishId: string,
  action: 'left' | 'right' | 'super',
  viewDuration?: number,
  position?: number,
  sessionId?: string
): Promise<{ success: boolean }> {
  const request: SwipeRequest = {
    userId,
    dishId,
    action,
    viewDuration,
    position,
    sessionId,
  };

  const response = await fetch(`${EDGE_FUNCTIONS_URL}/swipe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to track swipe');
  }

  return response.json();
}

/**
 * Generate unique session ID for grouping swipes within one usage session.
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
