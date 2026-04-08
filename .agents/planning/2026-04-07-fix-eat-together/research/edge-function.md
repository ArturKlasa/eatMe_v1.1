# Research: Group Recommendations Edge Function

## API Contract

**Endpoint:** `POST /functions/v1/group-recommendations`

### Request
```json
// Headers
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json

// Body
{
  "sessionId": "uuid (required)",
  "locationMode": "'midpoint' | 'host_location' (default: 'midpoint')",
  "radiusKm": "number (default: 5)"
}
```

### Authentication
- Verifies JWT via `supabase.auth.getUser()`
- Checks authenticated user is the session's `host_id`
- Uses **service role client** for all DB operations (bypasses RLS)

### Response (Success — 200)
```json
{
  "recommendations": [
    {
      "id": "string",
      "name": "string",
      "cuisine_types": ["string"],
      "rating": number,
      "address": "string",
      "phone": "string",
      "location": { "lat": number, "lng": number },
      "distance_m": number,
      "score": number,
      "compatibilityScore": number,  // 0-100
      "breakdown": {
        "vectorSimilarity": number,
        "cuisineCompatibility": number,
        "distanceScore": number,
        "ratingScore": number
      }
    }
  ],
  "metadata": {
    "searchCenter": { "lat": number, "lng": number },
    "radiusKm": number,
    "totalMembers": number,
    "personalized": boolean,
    "totalCandidates": number,
    "returned": number,
    "groupConstraints": { "diet": string, "allergens": [], "religious": [] }
  }
}
```

### Response (No Results — 200)
```json
{
  "recommendations": [],
  "message": "No restaurants found satisfying all group requirements",
  "conflicts": ["string describing constraint conflicts"],
  "groupConstraints": { ... }
}
```

### Error Responses
- **400**: Missing sessionId, < 2 active members, no searchable location
- **401**: Invalid/missing JWT
- **404**: Session not found or user is not host
- **500**: Internal error

## Key Behaviors
- Deletes old recommendations before inserting new ones
- Updates session status to `'voting'` after successful generation
- Auto-expands radius to 2x if no candidates found (one retry)
- Top 5 results saved to `eat_together_recommendations`
- Conflict analysis: all-vegan, 4+ allergens, halal+kosher

## Scoring Algorithm (V2 — Actual Implementation)

### Vector-based (when group_vector exists):
```
score = 0.4 × vector_similarity + 0.3 × cuisine_compat(0.5) + 0.2 × distance + 0.1 × rating
```

### Cold-start fallback (no vectors):
```
score = 0.4 × cuisine_compat(0.5) + 0.35 × rating + 0.25 × distance
```

Note: ALGORITHM.md describes an older V1 system and doesn't match the current code.

## Frontend Integration Pattern
```typescript
const { data, error } = await supabase.functions.invoke('group-recommendations', {
  body: { sessionId, locationMode, radiusKm }
});
```
