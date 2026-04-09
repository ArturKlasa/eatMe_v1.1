# Rating System Research Report for EatMe

## 1. Rating Scales Comparison for Food/Dish Ratings

### Scale Types and Their Properties

**Binary (Thumbs Up/Down)**
- Lowest cognitive load; highest completion rates
- Netflix saw a **200% increase in rating activity** when switching from 5-star to binary
- YouTube switched to binary in 2009 after finding users almost never gave 2, 3, or 4 stars — only 1 or 5, creating a useless J-shaped distribution
- A Yale/Nature study found that binary ratings **eliminate racial bias** present in 5-star systems
- Weakness: no middle ground; users hesitate to rate content they feel mildly positive about
- Used by: Uber Eats (for individual items), DoorDash (for individual items), YouTube, Pandora

**Three-Tier (liked/okay/disliked or equivalent)**
- Netflix evolved to this in 2022: thumbs down, thumbs up, double thumbs up
- DoorDash's new Zesty discovery app uses: "Loved this!", "Kinda mid", "Not for me" — a three-tier system
- Strikes a balance: lower friction than 5-star while capturing a "neutral" signal that pure binary misses
- This is what EatMe currently uses (liked/okay/disliked) — **well-aligned with industry direction**

**5-Star**
- Suffers from the well-documented **J-shaped distribution**: 78% of Amazon book ratings are 4+ stars
- Under-reporting bias + purchasing bias = inflated scores that cluster at 4.0-4.8 and lose discriminatory power
- Research shows 5-star systems are more enjoyable for users and better for "utilitarian" purchasing decisions
- Consumer expectations have inflated: **68% of consumers demand 4+ stars**, and **31% require 4.5+**
- Used by: Yelp, Google Maps, TripAdvisor, Amazon, Booking.com, Zomato

**10-Point**
- More granular but significantly higher cognitive load
- Used in professional food criticism (e.g., Andy Hayler's system, Savor app's weighted subscores)
- Not practical for casual mobile app users rating a lunch dish

**Emoji Scales**
- Research from Frontiers in Psychology developed the "EmojiGrid" for food-related emotional assessment
- MeasuringU found **no significant difference** in data quality between emoji and numbered scales
- However, emojis are "sometimes prone to multiple interpretations" and word-based formats were rated "significantly easier to use"
- Useful for engagement/fun but less precise than labels

### Verdict
The 3-tier system is validated by Netflix's evolution and DoorDash Zesty's independent convergence on the same pattern.

---

## 2. Dish-Level vs. Restaurant-Level Ratings

### Who Rates Individual Dishes?

**Major platforms with item-level ratings:**
- **Uber Eats**: Thumbs up/down on each menu item after delivery. Ratings visible to merchants (not customers), used internally
- **DoorDash**: Thumbs up/down on each item. Top 3 "most liked" items get a badge displayed on the menu
- **Google Maps**: Supports "recommended dishes" in structured review fields

**Dedicated dish-rating apps:**
- **Foodaholix**: Entire app built around rating individual dishes, not restaurants. "Decide what to eat, not where to eat"
- **Savor**: Personal food database with dish-level ratings using a weighted system (Taste 30%, Presentation 20%, Value 20%, Creativity 15%, Overall 15%)

### Should Restaurant Scores Be Derived from Dish Ratings?

Research strongly suggests a **hybrid approach**:

1. Dish ratings and restaurant ratings serve different purposes. A restaurant might have amazing pasta but mediocre pizza. A single restaurant score obscures this.
2. Restaurant-level attributes are separate from food quality. Google Maps reviews break into Food, Service, Atmosphere, and Value. Food appears in 87% of reviews, service in 56%, atmosphere in ~33%.
3. **Aggregation best practice — Bayesian Average:** `Bayesian Average = (C × m + Sum(ri)) / (C + n)` where C = global prior mean, m = minimum rating threshold, n = number of ratings.

---

## 3. Rating UX and Friction

### Optimal Number of Steps
- **Every additional step reduces completion**. 67% of users abandon flows after 15+ seconds of friction
- Optimal: 2-3 taps to submit a dish rating

### In-Context vs. Post-Visit Rating
- "By collecting feedback contextually — right after important actions — you get more meaningful, actionable insights"
- Post-experience follow-up works best 24-48 hours later
- Prompting at a moment of satisfaction increases positive ratings

### Participation Rates
- The **90-9-1 rule**: 90% of users lurk, 9% contribute occasionally, 1% contribute actively
- Amazon: only **1-2% of buyers leave text reviews**
- **70% of consumers will leave a review when explicitly asked**
- **71% will submit a review if the company makes it easy**
- With a 3-tier tap (no typing required), expect significantly higher participation than text review baseline

---

## 4. Text Reviews vs. Structured Feedback

### Do Users Read Text Reviews?
- **88% of consumers say written text reviews are more trustworthy** than star ratings alone
- **54% say the most helpful reviews mention specific pros and cons**
- BUT: **"short and happy" feedback works effectively** — detailed lengthy reviews ranked last (26%)
- **23% are happy with just review summaries**; 59% use summaries as a starting point

### Structured Tags vs. Free Text at Scale
**Structured tags are superior for:**
- Discoverability and filtering ("show me dishes rated for good value")
- Aggregation and trend analysis at scale
- Quick capture (low friction)
- AI/recommendation engine input

**Free text is superior for:**
- Context and nuance
- Building trust through personal stories
- SEO and content richness

---

## 5. Gamification in Rating Systems

### Does It Work?
- Google Local Guides uses points/badges/levels — has driven massive review volume
- Yelp Elite status drives prolific reviewing through exclusivity and social recognition
- Combinations of game elements (points + badges + leaderboard + feedback) show stronger effects

### Downsides and Risks
- "The gamified dopamine hit can encourage people to do things just for the sake of gaining points"
- Fake reviews, low-effort reviews, and multiple accounts are documented problems
- Rewarding wrong behaviors increases quantity while reducing quality

### What Works Best
- **Reward quality, not just quantity.** Points for tags and photos is better than points for just tapping a rating
- **Social recognition > material rewards.** Yelp Elite's social status model produces higher-quality reviews
- **Avoid rewarding rating volume directly.** Creates incentives for low-effort or fake ratings
- **Time-limited status** maintains quality pressure

---

## 6. Using Ratings for AI Recommendations

### How Ratings Feed Recommendation Engines
- **Collaborative Filtering:** "Users who liked this dish also liked..." — based on similar rating patterns
- **Content-Based Filtering:** Uses dish attributes (cuisine, ingredients, spice) to recommend similar
- **Hybrid Approach (best practice):** Combines both. Research shows hybrid systems outperform pure collaborative filtering and are more robust to cold-start

### Food Apps Doing This Well
- **Zomato**: AI recommends based on location, weather, and taste history; reportedly increased repeat orders by 30%
- **DoorDash Zesty**: Builds a "dynamic taste profile" from user behavior + Google Maps + TikTok + Reddit
- **Mala**: AI-powered "what should I eat?" that learns cravings, habits, and lifestyle

### EatMe's Position
3-tier opinion + tags + session view data = excellent foundation for hybrid recommender. A user who consistently tags "value" and "portion" has a very different taste profile from one who tags "presentation" and "flavor."

---

## 7. First-Principles Analysis

### When Browsing a Dish They Haven't Tried
The user's question: **"Is this dish worth ordering?"**

What actually helps:
1. **A clear positive signal** — "83% liked this" is more actionable than "4.2 stars"
2. **Why people liked it** — top tags like "Great flavor" and "Good value"
3. **Photos from real diners**
4. **Volume of ratings** — "83% liked this (47 ratings)" vs "100% liked this (2 ratings)"
5. **Recency** — 74% of consumers prioritize reviews from the last 3 months

What does NOT help much:
- A 4.3 star average (too abstract, inflated, not actionable)
- Long text reviews about service quality (irrelevant to the dish question)
- A single number restaurant score

### After Eating: Capturing Their Opinion
The user's constraint: **"I don't want this to take effort."**

Optimal path: 1 tap opinion + 0-1 tap tags + optional photo = under 5 seconds.

### Key Insight: Dish Ratings ≠ Restaurant Ratings

| Dimension | Dish Rating | Restaurant Rating |
|-----------|------------|-------------------|
| Core question | "Should I order this?" | "Should I go here?" |
| What matters | Taste, portion, value, freshness | Service, cleanliness, ambiance, wait time |
| Granularity needed | Simple (good/meh/bad) + tags | Dimensional (separate scores per aspect) |
| Personalization value | High (feeds taste profile) | Lower (universal preferences) |

---

## Sources
- [Appcues: 5 Stars vs Thumbs Up](https://www.appcues.com/blog/rating-system-ux-star-thumbs)
- [Yale Insights: Binary Ratings Eliminate Racial Bias](https://insights.som.yale.edu/insights/simple-thumbs-up-or-down-eliminates-racial-bias-in-online-ratings)
- [Emerald Insight: Five-star or thumbs up?](https://www.emerald.com/insight/content/doi/10.1108/intr-08-2016-0243/full/html)
- [ACM: Overcoming J-Shaped Distribution](https://cacm.acm.org/research/overcoming-the-j-shaped-distribution-of-product-reviews/)
- [BrightLocal: Local Consumer Review Survey 2026](https://www.brightlocal.com/research/local-consumer-review-survey/)
- [NN/g: Participation Inequality 90-9-1 Rule](https://www.nngroup.com/articles/participation-inequality/)
- [Variety: Netflix Two Thumbs Up](https://variety.com/2022/digital/news/netflix-two-thumbs-up-ratings-1235228641/)
- [Restaurant Business: DoorDash Zesty](https://www.restaurantbusinessonline.com/technology/doordash-testing-restaurant-discovery-app-called-zesty)
- [TechCrunch: DoorDash Zesty](https://techcrunch.com/2025/12/16/doordash-rolls-out-zesty-an-ai-social-app-for-discovering-new-restaurants/)
- [Search Engine Land: 70% Leave Reviews When Asked](https://searchengineland.com/70-consumers-will-leave-review-business-asked-262802)
- [Savor: Dish Rating App](https://www.savortheapp.com/)
- [Foodaholix: Food Rating App](https://apps.apple.com/us/app/food-rating-app-foodaholix/id1587747643)
- [MeasuringU: Emoji vs Number Scales](https://measuringu.com/numbers-versus-face-emojis/)
- [Frontiers: EmojiGrid for Food Emotions](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2018.02396/full)
- [Medium: Bayesian Estimate of Star Ratings](https://medium.com/district-data-labs/computing-a-bayesian-estimate-of-star-rating-means-651496a890ab)
- [Nordstone: AI-Powered Food Delivery](https://nordstone.co.uk/blog/how-ai-powered-food-delivery-apps-are-enhancing-customer-experience)
- [Northwestern: Hybrid Restaurant Recommender](https://sites.northwestern.edu/msia/2019/04/24/personalized-restaurant-recommender-system-using-hybrid-approach/)
- [Search Engine Land: Google Local Guides](https://searchengineland.com/guide/google-local-guides-program-wins-woes-what-next)
- [Survicate: User Friction](https://survicate.com/blog/user-friction/)
- [WiserReview: Online Review Statistics](https://wiserreview.com/blog/online-review-statistics/)
