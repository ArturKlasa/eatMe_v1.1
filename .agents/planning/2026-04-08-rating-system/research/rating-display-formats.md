# Rating Display Formats — Deep Research

## 1. Percentage vs Stars vs Other Formats

**Star ratings (5-star):**
- Scored highest as "most preferred" for both raters and viewers in UX research
- Best for complex purchasing decisions where users need confidence
- Critical: **70% of users pick the option with more reviews even if the average is lower** — 4.5★ with 180 reviews beats 4.8★ with 39 reviews
- Scores above 4.9 actually reduce trust — users suspect fake reviews
- Suffer from J-shaped distribution (mostly 5s and 1s)

**Binary → percentage format:**
- Netflix saw **200% more ratings** switching from stars to thumbs
- Reduces cognitive load, increases participation
- Better for algorithmic personalization

**Percentage "would recommend" format:**
- Smashing Magazine: "86% of customers recommend" is "distinct from star ratings and potentially more meaningful"
- This is the Rotten Tomatoes model applied to products
- **No major food app currently uses this as primary display** — differentiation opportunity

**Numerical decimal (e.g., 4.2):**
- Yelp added decimals alongside half-stars because 0.5 increments were too coarse for comparison

---

## 2. What Top Food Apps Actually Show

| App | Restaurant Display | Dish Display |
|-----|-------------------|-------------|
| **Google Maps** | Star + decimal (4.3) + count on pins and cards | "Popular dishes" label — no score, just ML-detected mentions |
| **Uber Eats** | 5-star decimal + count (4.6, 500+), "Top Eats" badge | Thumbs up/down collected but **not shown to consumers** |
| **DoorDash** | Star + count + written reviews | "Most Liked" tag on top 3 items by thumbs-up count. No percentage |
| **Yelp** | Half-star visual + decimal (4.2) + count. AI Review Insights: categories scored 1-100 | No dish-level ratings |
| **TripAdvisor** | "Bubble" rating + decimal. Sub-ratings: Food, Service, Value, Atmosphere. "Travelers' Choice" badge (top 10%) | No dish-level ratings |
| **Zomato** | Dual ratings: Delivery (red stars) and Dining (black stars), contextually shown | No dish-level ratings |
| **TheFork** | Mixed user ratings + Michelin data. "Insider" badge (expert-curated) | No dish-level ratings |
| **Savor** | N/A (dish-only app) | 10-point weighted scale (Taste 30%, Presentation 20%, Value 20%, Creativity 15%, Overall 15%) |
| **Foodaholix** | 1-5 stars | 1-5 stars per dish + photos |

**Key insight: No major food app shows dish-level percentage ratings to consumers. EatMe's "85% ❤️ 12" is genuinely unique.**

---

## 3. Compact Display — Map Markers vs Cards vs Detail

**Map pins:**
- Google Maps proves a single number (e.g., "4.3") fits inside a standard pin
- Color of pin itself can encode quality tier (no text needed)
- At most: one number + one small icon. Anything more requires tap to expand
- "85% ❤️ 12" is too much for a pin — show just percentage or color-coded dot

**Card/list view:**
- Typical card: Photo + name + rating display + price + distance
- "85% ❤️ 12" format is compact enough — 3 data points in ~8 characters
- Add one-line tag when available ("Known for: crispy crust")

**Progressive disclosure:**
- Pin: minimal (percentage number + color)
- Card: medium ("85% 👍 (47)" + top tag)
- Detail: full (distribution, photos, all tags, notes)

---

## 4. Color Coding and Badges

**Color tiers in production apps:**
- Green = good/fresh; Yellow/amber = moderate; Red = poor (traffic light pattern)
- Order Healthy app: green/yellow/red circles as health rating
- Zomato: red vs black stars for delivery vs dining (functional, not quality)

**Badges in production:**
- DoorDash: **"Most Liked"** tag (top 3 items per restaurant)
- Uber Eats: **"Top Eats"** badge (restaurant level)
- TripAdvisor: **"Travelers' Choice"** (top 10%), **"Best of the Best"** (top 1%)
- TheFork: **"Insider"** (expert-curated)
- Google Maps: **"Popular"** label (frequently mentioned dishes)

**Recommendation for EatMe:**
- Green tint for ≥80% approval
- Neutral/amber for 60-79%
- No display or subtle gray for <60% (don't actively show "bad" — just don't highlight)
- Consider "Trending" badge for rapidly increasing ratings

---

## 5. Tag/Reason Display — Showing WHY

**Yelp Review Insights (gold standard):**
- AI aggregates reviews into sentiment categories (food quality, service, ambiance, wait time, drinks)
- Each scored 1-100 as positive/neutral/critical
- Tapping a category shows relevant review excerpts

**Google Maps AI Review Summaries:**
- Synthesizes key themes ("Visitors praise the diverse selection and vibrant atmosphere")
- Auto-labels dishes as "popular" based on mention frequency

**DoorDash:**
- "Most Loved" restaurants recognized for specific traits: on-time, accuracy, food quality
- Curated "Top 10" lists by category

**For EatMe's dish-level tags:**
- Auto-generated from structured tags: "Great flavor", "Generous portions"
- Show top 2-3 tags alongside the score: `85% 👍 (47) · Great flavor · Good value`
- This is a strong differentiator — no competitor shows dish-level reason tags

---

## 6. Social Proof Elements

**Most effective signals:**
- **Rating count** — 70% of users prioritize count over score
- **"Most Liked" badges** — DoorDash's top 3 per restaurant, simple and effective
- **Photos from diners** — Google Maps matches photos to specific dishes
- **Recency** — DoorDash shows most recent reviews first
- **Trending indicators** — "Popular this week", "X people tried recently"

**EatMe's "85% ❤️ 12" already includes the two most important elements: approval rate + count.**

---

## 7. Rotten Tomatoes Model for Food

**How RT works:**
- Tomatometer: percentage of positive reviews
- Thresholds: Fresh ≥ 60%, Certified Fresh ≥ 75% with minimum count, Rotten < 60%
- Dual score: critic % + audience %

**No food app currently uses this model explicitly. This is clear white space.**

**Why it fits EatMe:**
- "85% ❤️ 12" is structurally identical to "85% Tomatometer (12 reviews)"
- Add threshold badges: "Certified Delicious" (≥90% with 20+ ratings), "Fresh Pick" (≥75%)
- The percentage is more intuitive for food because the question IS binary: "Did you enjoy this dish?"
- Netflix proved binary input + percentage display drives 200% more engagement than stars

**Note:** Netflix is moving away from match percentages toward descriptive tags, suggesting percentage + qualitative tags together is the optimal combination.

---

## Sources
- [Smashing Magazine - Product Reviews and Ratings UX](https://www.smashingmagazine.com/2023/01/product-reviews-ratings-ux/)
- [Appcues - 5 Stars vs Thumbs Up/Down](https://www.appcues.com/blog/rating-system-ux-star-thumbs)
- [UX Blog - Rating Systems for Restaurants](https://medium.com/theuxblog/rating-systems-for-restaurants-likes-vs-stars-b371d8aa1a42)
- [Yelp Blog - Numerical Ratings](https://blog.yelp.com/news/yelp-adds-numerical-ratings-to-help-consumers-easily-compare-multiple-businesses/)
- [TechCrunch - DoorDash Reviews](https://techcrunch.com/2022/06/13/doordash-app-features-including-written-reviews-item-ratings/)
- [DoorDash Help - Most Liked Items FAQ](https://help.doordash.com/consumers/s/article/Frequently-Asked-Questions-Most-Liked-Items-Item-Ratings)
- [Uber Help - Item Ratings](https://help.uber.com/en/ubereats/restaurants/article/how-to-rate-the-items-in-my-order)
- [TripAdvisor - Bubble Rating](https://www.tripadvisor.com/business/insights/resources/bubble-rating)
- [Zomato Blog - New Ratings](https://www.zomato.com/blog/new-ratings/)
- [Google Maps - Popular Dishes](https://blog.google/products/maps/popular-dishes-feature-maps/)
- [TechCrunch - Yelp AI Review Insights](https://techcrunch.com/2024/12/10/yelp-adds-ai-powered-review-insights-to-restaurants/)
- [Rotten Tomatoes FAQ](https://www.rottentomatoes.com/faq)
- [Map UI Patterns - Markers](https://mapuipatterns.com/marker/)
- [NN/G - Mobile Maps](https://www.nngroup.com/articles/mobile-maps-locations/)
