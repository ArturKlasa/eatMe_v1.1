/**
 * Gamification Service
 *
 * Handles streak tracking and badge awarding:
 * - updateStreak: tracks consecutive weeks with at least one rating
 * - checkAndAwardTrustedTasterBadge: awards badge after 20+ tagged ratings over 3+ months
 */

import { supabase } from '../lib/supabase';

const STREAK_MILESTONES = [
  { weeks: 3, points: 15 },
  { weeks: 7, points: 30 },
  { weeks: 14, points: 50 },
];

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  milestoneHit: { weeks: number; points: number } | null;
}

export interface BadgeResult {
  earned: boolean;
}

/**
 * Get the ISO week start date (Monday) for a given date, in YYYY-MM-DD format.
 */
function getWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

function getLastWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 7);
  return getWeekStart(d);
}

/**
 * Update the user's rating streak. Call after any successful rating submission.
 * - If already rated this week: no-op, returns current state.
 * - If rated last week: increments streak.
 * - Otherwise: resets streak to 1.
 * Awards bonus points when a streak milestone (3, 7, 14 weeks) is hit exactly.
 */
export async function updateStreak(userId: string): Promise<StreakResult> {
  const now = new Date();
  const thisWeek = getWeekStart(now);
  const lastWeek = getLastWeekStart(now);

  const { data: existing } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak, last_rating_week')
    .eq('user_id', userId)
    .maybeSingle();

  let currentStreak: number = existing?.current_streak ?? 0;
  let longestStreak: number = existing?.longest_streak ?? 0;
  const lastRatingWeek: string | null = existing?.last_rating_week ?? null;

  // Already rated this week — no change
  if (lastRatingWeek === thisWeek) {
    return { currentStreak, longestStreak, milestoneHit: null };
  }

  if (lastRatingWeek === lastWeek) {
    // Consecutive week
    currentStreak += 1;
  } else {
    // Missed a week (or first rating ever)
    currentStreak = 1;
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  const milestoneHit = STREAK_MILESTONES.find(m => m.weeks === currentStreak) ?? null;

  // Award milestone points asynchronously (non-fatal)
  if (milestoneHit) {
    supabase
      .from('user_points')
      .insert({
        user_id: userId,
        points: milestoneHit.points,
        action_type: 'weekly_streak_bonus',
        description: `${milestoneHit.weeks}-week streak bonus`,
      })
      .then(({ error }) => {
        if (error) {
          console.warn('[GamificationService] Failed to award streak milestone points:', error);
        }
      });
  }

  // Upsert the streak row
  await supabase.from('user_streaks').upsert(
    {
      user_id: userId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_rating_week: thisWeek,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  return { currentStreak, longestStreak, milestoneHit };
}

/**
 * Check if the user qualifies for the Trusted Taster badge and award it if so.
 * Eligibility: 20+ tagged ratings over at least 3 months.
 * Idempotent: returns { earned: false } if badge already exists.
 */
export async function checkAndAwardTrustedTasterBadge(userId: string): Promise<BadgeResult> {
  // Check if badge already awarded
  const { data: existingBadge } = await supabase
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_type', 'trusted_taster')
    .maybeSingle();

  if (existingBadge) {
    return { earned: false };
  }

  // Check total tagged ratings (tags not null and not empty)
  const { count: taggedCount } = await supabase
    .from('dish_opinions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('tags', 'is', null)
    .neq('tags', '{}');

  if (!taggedCount || taggedCount < 20) {
    return { earned: false };
  }

  // Check tenure: earliest tagged rating must be at least 3 months ago
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: earliestRating } = await supabase
    .from('dish_opinions')
    .select('created_at')
    .eq('user_id', userId)
    .not('tags', 'is', null)
    .neq('tags', '{}')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!earliestRating || new Date(earliestRating.created_at) > threeMonthsAgo) {
    return { earned: false };
  }

  // Award badge
  const { error } = await supabase.from('user_badges').insert({
    user_id: userId,
    badge_type: 'trusted_taster',
  });

  if (error) {
    console.error('[GamificationService] Failed to insert trusted_taster badge:', error);
    return { earned: false };
  }

  return { earned: true };
}
