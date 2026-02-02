# Group Recommendations Algorithm

**Version:** 2.0  
**Last Updated:** February 1, 2026

## Overview

The group recommendations algorithm generates restaurant suggestions for Eat Together sessions by analyzing all members' dietary preferences, restrictions, locations, and soft preferences. It balances hard constraints (must satisfy 100%) with soft preferences to find the best possible options for the group.

## Scoring System

The algorithm uses a **multi-factor scoring system** with a theoretical max of ~200 points:

### 1. Base Compatibility (0-100 points)

Each member contributes a score based on how well the restaurant matches their preferences:

- **Starting score:** 50 points
- **Vegan requirement met:** +20 points
- **Vegetarian requirement met:** +15 points
- **Halal/Kosher certification:** +20 points each
- **Allergies present:** -5 points (requires verification)
- **Vegetarian options limited:** -20 points
- **Meat-focused menu (no meat preference):** HARD FAIL
- **Seafood-focused (no seafood preference):** HARD FAIL

Final score is averaged across all members.

### 2. Restaurant Quality Bonus (0-50 points)

Based on restaurant rating:

```
Rating × 10 = Bonus Points
e.g., 4.5 rating = 45 points
```

### 3. Distance Score (0-20 points)

Rewards proximity to meeting point:

| Distance | Points |
| -------- | ------ |
| < 1 km   | 20     |
| < 2 km   | 15     |
| < 3 km   | 10     |
| < 5 km   | 5      |
| ≥ 5 km   | 0      |

### 4. Cuisine Preference Score (0-30 points)

Matches restaurant cuisines against member preferences:

- **Member's preferred cuisine:** +10 points
- **No preference (neutral):** +5 points
- **Not preferred but acceptable:** +2 points

Score is averaged across members, max 30 points.

### 5. Price Consensus Score (0-10 points)

Measures how well restaurant price aligns with group preferences:

```
Deviation = |Restaurant Price - Member's Preferred Range|
Avg Deviation across all members:
  - 0 deviation = 10 points
  - ≥ 2 levels = 0 points
  - Linear scale between
```

## Hard Constraints (Must Satisfy 100%)

These are **non-negotiable** - any member's hard constraint not met = restaurant excluded:

1. **Vegan Diet**
   - Restaurant must have vegan options
   - Checks cuisine types for: vegan, vegetarian, plant-based
   - Checks `has_vegan_options` flag

2. **Religious Restrictions**
   - **Halal:** Must have halal certification or halal cuisine type
   - **Kosher:** Must have kosher certification or kosher cuisine type
   - Both required = very rare, will likely find nothing

3. **Dietary Exclusions**
   - **No Meat:** Excludes steakhouses, BBQ, grills
   - **No Seafood:** Excludes seafood restaurants, sushi bars
   - **No Dairy/Eggs:** Requires vegan options

4. **Critical Allergies**
   - Currently warns but doesn't hard-fail (needs menu allergen data)
   - Reduces score slightly to prioritize manual verification

## Edge Case Handling

### No Results Found

**Step 1:** Auto-expand search radius (2x original)

**Step 2:** If still no results, analyze conflicts:

```typescript
analyzeRestrictionConflicts(members):
  - All members vegan → very limited options
  - >70% members have restrictions → difficult to satisfy
  - Halal + Kosher required → rare combination
```

**Step 3:** Generate actionable suggestions:

- Expand search radius manually
- Choose different meeting location
- Consider restaurants specializing in diverse diets
- Identify which restrictions are causing issues

### Vegetarian vs Vegan

- **Vegan:** Strict requirement, hard fails if not available
- **Vegetarian:** Softer requirement, penalty but most restaurants have veggie options

### Missing Data

- **No rating:** Defaults to 4.0
- **No price level:** Neutral score (5 points)
- **No cuisine types:** 0 cuisine score
- **No member preferences:** Neutral scores across the board

## Location Modes

### 1. Host Location

Uses the host's current location as search center.

### 2. Midpoint

Calculates average of all members' locations:

```
avgLat = sum(member.lat) / count
avgLng = sum(member.lng) / count
```

### 3. Max Radius

Uses midpoint but considers maximum distance from any member (future enhancement).

## Recommendation Process

```
1. Fetch all session members
2. Load each member's preferences from user_preferences table
3. Calculate search center based on location mode
4. Query nearby_restaurants RPC with radius
5. Score each restaurant using multi-factor algorithm
6. Filter out restaurants failing hard constraints
7. Sort by compatibility score (descending)
8. Take top 5 for voting
9. If no results, expand radius and retry
10. If still no results, return conflict analysis
11. Save recommendations to eat_together_recommendations table
12. Update session status to 'voting'
```

## Future Enhancements

### Short Term

- [ ] Menu-level allergen data integration
- [ ] Better cuisine matching (similarity scores)
- [ ] Operating hours filter (currently open)
- [ ] Service type filter (dine-in, takeout, delivery)

### Medium Term

- [ ] Machine learning for preference patterns
- [ ] Historical group satisfaction tracking
- [ ] Weather-based recommendations (outdoor seating)
- [ ] Wait time / reservation availability

### Long Term

- [ ] AI-powered dietary analysis from menus
- [ ] Real-time menu availability via restaurant APIs
- [ ] Nutritional information matching
- [ ] Social proof (friends who've been here)

## Testing Scenarios

### Scenario 1: Simple Group

- 3 members, all "all" diet preference
- No restrictions
- Expected: High variety, score dominated by rating + distance

### Scenario 2: Vegan Member

- 2 members "all", 1 member "vegan"
- Expected: Only vegan-friendly restaurants
- Hard fail on non-vegan restaurants

### Scenario 3: Religious Restrictions

- 1 member halal, 1 member kosher
- Expected: Very few results or conflict warning
- Suggestion to relax constraints

### Scenario 4: No Results

- Remote location + strict vegan + halal + multiple allergies
- Expected: Expanded radius attempt → Conflict analysis → Suggestions

### Scenario 5: Price Mismatch

- Budget member ($), luxury member ($$$$)
- Expected: Mid-range restaurants score highest
- Extreme ends penalized

## Performance Considerations

- **Database queries:** 4-5 per recommendation (members, preferences, restaurants, save)
- **Scoring complexity:** O(n × m) where n = restaurants, m = members
- **Typical execution:** 1-3 seconds for 20 restaurants, 5 members
- **Edge function timeout:** 60 seconds (more than sufficient)

## Error Handling

All errors return helpful context:

```json
{
  "error": "Description",
  "searchCenter": { ... },
  "radiusKm": 5,
  "conflicts": ["..."],
  "suggestions": ["..."]
}
```

Never fails silently - always explains what went wrong and how to fix it.

---

**For Deployment:**

```bash
supabase functions deploy group-recommendations --project-ref YOUR_PROJECT_REF
```

**Environment Variables Required:**

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
