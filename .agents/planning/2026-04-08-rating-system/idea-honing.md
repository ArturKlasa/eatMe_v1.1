# Idea Honing: Rating System Redesign

Requirements clarification with research-backed recommendations.

---

## Q1: What are the main problems with the current rating system?

The current system uses a 3-tier opinion (liked/okay/disliked) for dishes and 5 yes/no questions for restaurants. What specifically feels wrong or insufficient about it?

**Recommendation:** The current system's core model (3-tier + tags) is actually **well-aligned with industry best practices**. The main issues to address are:
1. **Too much friction** — the multi-step wizard creates abandonment. 67% of users abandon flows after 15+ seconds.
2. **No in-context rating** — users can only rate via a post-visit flow, not directly from a dish detail screen.
3. **Restaurant ratings feel disconnected** — the 5 yes/no questions don't connect to dish quality and aren't displayed prominently.

**Answer:** Keep the 3-tier model, reduce friction by adding in-context rating (rate directly from dish detail screen — confirmed by user), and improve restaurant score display. No text opinions — structured tags only for dish feedback.

---

## Q2: What is the primary goal of ratings — helping users discover good food, or helping restaurants improve?

- **User discovery**: Ratings exist mainly so browsing users can quickly judge "should I order this dish / visit this restaurant?"
- **Restaurant feedback**: Ratings exist to give restaurant owners actionable insights
- **Both equally**

**Recommendation: User discovery (primary), with restaurant feedback as a byproduct.**

EatMe is a consumer-facing discovery app — the core question ratings answer is "Is this dish worth ordering?" and "Should I go to this restaurant?" The structured tags naturally produce actionable insights for restaurant owners as a side benefit.

**Answer:** User discovery (primary), restaurant feedback as byproduct.

---

## Q3: Rating granularity for dishes — how fine-grained should it be?

Options:
- **Binary** (thumbs up/down, like Tinder/YouTube)
- **3-tier** (liked/okay/disliked — current system)
- **5-star scale** (classic, like Google Maps/Yelp)
- **10-point scale** (more precision, like IMDb)
- **Emoji/sentiment scale**

**Recommendation: Keep 3-tier (liked/okay/disliked).**

The research strongly supports this:
- **Binary** gets 200% more engagement (Netflix data) but loses the critical "meh/okay" middle signal — a dish that's "fine but not worth going out of your way for" is genuinely different from one you actively disliked.
- **5-star** suffers from the J-shaped distribution problem (78% of Amazon ratings are 4+), creating meaningless score inflation. Users overwhelmingly give 1 or 5, making it functionally binary but with higher cognitive load.
- **3-tier** captures liked/neutral/disliked — the three actionable signals — with minimal friction. Netflix evolved from 5-star → binary → 3-tier (thumbs down, thumbs up, double thumbs up). DoorDash Zesty launched with "Loved this!", "Kinda mid", "Not for me." Two major players independently converged here.
- **10-point** and **emoji** scales add cognitive load without proportional value for casual food ratings.

**Answer:** Keep 3-tier (liked/okay/disliked). Validated by Netflix and DoorDash Zesty convergence.

---

## Q4: Should restaurant ratings be derived from dish ratings, or rated independently?

- **Derived**: Restaurant score = aggregate of its dish ratings (no separate restaurant rating step)
- **Independent**: Users rate restaurant experience separately (ambiance, service, etc.)
- **Hybrid**: Dish ratings drive food score; separate quick feedback for service/ambiance

**Recommendation: Hybrid.**

Research shows dish quality and restaurant experience are genuinely different dimensions:
- Food quality appears in 87% of Google Maps reviews; service in 56%; atmosphere in 33%. They are separate evaluation axes.
- A restaurant might have incredible pasta but mediocre pizza — a single derived score obscures this. But service, cleanliness, and wait time are restaurant-wide attributes that can't be captured in dish ratings.
- **Proposed model:** Restaurant "food score" = Bayesian average of its dish ratings. Restaurant "experience" = aggregated yes/no feedback (keep current service_friendly, clean, wait_time_reasonable, would_recommend, good_value). Display both dimensions separately: "87% liked the food · 92% friendly service."
- Bayesian averaging prevents a restaurant with 1 rating from outranking one with 200 solid ratings.

**Answer:** Hybrid — food score derived from dish ratings (Bayesian avg), experience scored via separate yes/no questions.

---

## Q5: How important is rating friction (speed vs. detail)?

- **Minimal friction**: Rate a dish in 1 tap from the dish card
- **Moderate friction**: 1-2 step flow (rating + optional extras)
- **Detailed flow**: Keep multi-step structured feedback (current approach)

**Recommendation: Dual-path — minimal friction for dish ratings, moderate for the full visit flow.**

Key findings:
- Only **1-2% of users leave text reviews** (Amazon data), but **70% will leave a review when explicitly asked** and the process is easy.
- 67% abandon after 15+ seconds of friction.
- The current 5-step wizard is too heavy for the common case.

**Proposed approach:**
1. **Quick path (primary):** "Tried it?" button on dish detail → 1 tap (liked/okay/disliked) → optional tag selection → done. Under 5 seconds. This should be the default way to rate.
2. **Full path (optional):** Keep the post-visit flow for users who want to rate multiple dishes + restaurant experience + upload photos. But make it feel optional, not required.

This maximizes participation (quick path) while preserving detail for power users (full path).

**Answer:** Dual-path — 1-tap in-context rating from dish detail (primary) + optional full post-visit flow.

---

## Q6: Should the system support text reviews / free-form comments?

- **No** — keep it structured (tags, ratings only)
- **Optional short comment** — e.g., max 140 chars
- **Full reviews** — like Yelp/Google, with title + body

**Recommendation: Optional short comment (max 140 characters).**

Research findings:
- 88% of consumers say text is more trustworthy than scores alone.
- BUT "short and happy" feedback works effectively — detailed lengthy reviews ranked last (26%) in consumer priorities.
- 23% are happy with just summaries; 59% use summaries as a starting point.
- Structured tags remain the primary feedback mechanism — they're better for aggregation, filtering, and AI.
- A short note captures nuance that tags can't ("the carbonara was great but skip the tiramisu") without the friction of a full review.
- Do NOT make it mandatory — it should be a "+ Add a note" expansion, not a required field.
- No text opinions on dish ratings — only structured tags.

**Answer:** Optional short note (max 47 characters) available only in the full post-visit flow, NOT on the quick in-context rating. No text input for dish opinions — tags only.

---

## Q7: How should ratings be displayed to browsing users?

- **Single score** (e.g., "4.2 ★" or "87% liked")
- **Score + count** (e.g., "4.2 ★ (48 ratings)")
- **Score + breakdown** (e.g., score + tag cloud or category bars)
- **Comparison-friendly** (e.g., ranked within restaurant or area)

**Recommendation: Score + count (primary), with breakdown on detail view.**

Research findings:
- "83% liked this" is more actionable than "4.2 stars" — percentages are honest and intuitive, while star averages are inflated and abstract.
- Rating count provides trust calibration — "83% (47 ratings)" vs "100% (2 ratings)."
- 74% of consumers prioritize reviews from the last 3 months — consider showing recency.
- Top tags ("Great flavor · Good value") answer the follow-up question of *why* people liked it.

**Proposed display:**
- **On dish cards / map markers:** `83% 👍 (47)` — compact, scannable
- **On dish detail:** `83% liked · 47 ratings` + top 3 tags + optional user photos
- **On restaurant detail:** Food score (derived from dishes) + experience scores (service, clean, etc.) + per-dish breakdown

**Answer:** Option C — Percentage + tier badges + tags. Display:
- **Map pins:** percentage number with color coding (green ≥80%, amber 60-79%, hide <60%)
- **Dish cards:** `85% 👍 (47) · Great flavor · Good value`
- **Dish detail:** full distribution + all tags + user photos
- **Restaurant detail:** food score (Bayesian avg of dish ratings) + experience scores + per-dish breakdown
- Add threshold badges (e.g. special icon for ≥90% with 20+ ratings). Unique in the food app space — no competitor shows dish-level percentage ratings.

---

## Q8: Should the rating system feed into the AI preference engine?

- **Train personal recommendations** (your ratings improve your feed)
- **Only contribute to public scores** (visible to all, not personalized)
- **Both**

**Recommendation: Both.**

This is a strong competitive advantage for EatMe:
- The 3-tier opinion is a clean explicit signal for collaborative filtering ("users who liked this dish also liked...")
- Tags are rich content features for content-based filtering (a user who consistently selects "value" + "portion" has a very different taste profile from one who selects "presentation" + "flavor")
- Session view data (which dishes users browse, how long) provides implicit behavioral signals
- Netflix found that **behavioral data was more valuable than explicit ratings** — EatMe already captures both
- Hybrid recommender (collaborative + content-based) outperforms either alone and handles cold-start better
- Zomato reportedly increased repeat orders by 30% with AI recommendations

The 3-tier + tags + browsing data is an excellent foundation for "People with your taste also loved..." recommendations.

**Answer:** Both — public scores + personal recommendations.

---

## Q9: Should the gamification/points system be kept?

- **Keep and expand** the points system
- **Keep as-is**
- **Remove** — simplify, let intrinsic motivation drive ratings
- **Replace** with something else (badges, levels, etc.)

**Recommendation: Keep and refine.**

Research findings:
- Google Local Guides proves gamification drives massive volume, but also created quality problems — fake/low-effort reviews for points.
- Yelp Elite's social recognition model produces higher-quality reviews than Google's transactional model.
- Rewarding **quality over quantity** is key — EatMe's current weighting (15 pts for photo > 10 pts for rating > 5 pts for tags) already does this well.

**Proposed refinements:**
- Keep the current point values but add a **"Trusted Taster" badge** earned through consistency (e.g., 20+ ratings with tags over 3+ months), not volume
- Add **streak mechanics** ("You've rated dishes at 3 restaurants this week!") — these create habit loops
- **Do NOT add a public leaderboard** — it incentivizes gaming
- Consider **weighting photos even higher** (20 pts) — user photos are the single highest-value content in food discovery

**Answer:** Keep and refine — add "Trusted Taster" badge, streak mechanics, weight photos higher. No public leaderboard.

---

## Q10: What's the migration strategy preference?

- **Big bang**: Replace the current system entirely, migrate old data
- **Gradual**: Run new system alongside old, transition over time
- **Fresh start**: New system, old ratings archived/discarded

**Recommendation: Big bang with data migration.**

Rationale:
- The core data model (3-tier opinions + tags) is **staying the same** — this isn't a fundamental schema change, it's an enhancement (adding quick-rate path, optional notes, refined display, better aggregation).
- Existing `dish_opinions`, `restaurant_experience_responses`, and `user_points` data is fully compatible with the new system.
- Running two systems in parallel adds complexity without clear benefit since the underlying rating model isn't changing.
- The main changes are: (1) new UI entry points (in-context rating), (2) optional text note field, (3) refined display/aggregation, (4) Bayesian averaging. All of these can layer on top of the existing data.
- Migration = add `note` column to `dish_opinions` + update materialized views + deploy new UI components.

**Answer:** Big bang with data migration. Core model stays the same; changes layer on top.
