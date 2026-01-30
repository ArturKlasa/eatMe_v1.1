#!/bin/bash

# Test Supabase Edge Functions
# Usage: ./test-edge-functions.sh

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Supabase configuration
SUPABASE_URL="https://tqroqqvxabolydyznewa.supabase.co"
# Get your anon key from: https://supabase.com/dashboard/project/tqroqqvxabolydyznewa/settings/api
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcm9xcXZ4YWJvbHlkeXpuZXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyNTQ5MDAsImV4cCI6MjA3MzgzMDkwMH0.wy8yzDPcyWwUDGwdM78-SE7zunEXxbyVGjP3s5ZdgH0"

echo -e "${YELLOW}Testing Supabase Edge Functions${NC}\n"

# ============================================================================
# Test 1: Feed Function
# ============================================================================

echo -e "${YELLOW}Test 1: Testing /functions/v1/feed${NC}"
echo "Requesting dishes near San Francisco (37.7749, -122.4194) within 10km..."

FEED_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/feed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "location": {"lat": 37.7749, "lng": -122.4194},
    "radius": 10,
    "filters": {
      "priceRange": [1, 3],
      "dietPreference": "all"
    },
    "limit": 20
  }')

if echo "$FEED_RESPONSE" | grep -q "dishes"; then
  echo -e "${GREEN}✓ Feed function working!${NC}"
  echo "Response preview:"
  echo "$FEED_RESPONSE" | jq -r '.metadata // "No metadata"'
  DISH_COUNT=$(echo "$FEED_RESPONSE" | jq -r '.dishes | length // 0')
  echo "Dishes returned: $DISH_COUNT"
  
  # Extract first dish ID for swipe test
  FIRST_DISH_ID=$(echo "$FEED_RESPONSE" | jq -r '.dishes[0].id // ""')
  FIRST_RESTAURANT_ID=$(echo "$FEED_RESPONSE" | jq -r '.dishes[0].restaurant_id // ""')
else
  echo -e "${RED}✗ Feed function failed!${NC}"
  echo "Response:"
  echo "$FEED_RESPONSE" | jq '.' || echo "$FEED_RESPONSE"
  exit 1
fi

echo ""

# ============================================================================
# Test 2: Feed Function with Filters
# ============================================================================

echo -e "${YELLOW}Test 2: Testing /functions/v1/feed with vegan filter${NC}"

FEED_VEGAN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/feed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "location": {"lat": 37.7749, "lng": -122.4194},
    "radius": 10,
    "filters": {
      "priceRange": [1, 4],
      "dietPreference": "vegan",
      "calorieRange": {"min": 200, "max": 800}
    },
    "limit": 20
  }')

if echo "$FEED_VEGAN_RESPONSE" | grep -q "dishes"; then
  echo -e "${GREEN}✓ Feed function with filters working!${NC}"
  VEGAN_DISH_COUNT=$(echo "$FEED_VEGAN_RESPONSE" | jq -r '.dishes | length // 0')
  echo "Vegan dishes returned: $VEGAN_DISH_COUNT"
else
  echo -e "${RED}✗ Feed function with filters failed!${NC}"
  echo "Response:"
  echo "$FEED_VEGAN_RESPONSE" | jq '.' || echo "$FEED_VEGAN_RESPONSE"
fi

echo ""

# ============================================================================
# Test 3: Swipe Function (requires user authentication)
# ============================================================================

echo -e "${YELLOW}Test 3: Testing /functions/v1/swipe${NC}"

# Note: This requires a valid user UUID
# You'll need to replace this with an actual user ID from your auth.users table
TEST_USER_ID="00000000-0000-0000-0000-000000000000"

if [ -n "$FIRST_DISH_ID" ] && [ "$FIRST_DISH_ID" != "" ]; then
  echo "Using dish ID from previous test: $FIRST_DISH_ID"
  
  SWIPE_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/swipe" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -d "{
      \"userId\": \"${TEST_USER_ID}\",
      \"dishId\": \"${FIRST_DISH_ID}\",
      \"action\": \"right\",
      \"viewDuration\": 3500,
      \"position\": 1,
      \"sessionId\": \"test-session-$(date +%s)\"
    }")

  if echo "$SWIPE_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Swipe function working!${NC}"
    echo "Response: $SWIPE_RESPONSE"
  else
    echo -e "${RED}✗ Swipe function failed!${NC}"
    echo "Response:"
    echo "$SWIPE_RESPONSE" | jq '.' || echo "$SWIPE_RESPONSE"
  fi
else
  echo -e "${YELLOW}⊘ Skipping swipe test (no dish ID available)${NC}"
fi

echo ""

# ============================================================================
# Test 4: Cache Test (call feed twice)
# ============================================================================

echo -e "${YELLOW}Test 4: Testing cache (calling feed twice)${NC}"

echo "First call (cache miss)..."
START_TIME=$(date +%s%N)
FEED_RESPONSE_1=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/feed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "location": {"lat": 37.7749, "lng": -122.4194},
    "radius": 5,
    "filters": {},
    "limit": 10
  }')
END_TIME=$(date +%s%N)
FIRST_CALL_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

echo "Second call (should be cached)..."
START_TIME=$(date +%s%N)
FEED_RESPONSE_2=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/feed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "location": {"lat": 37.7749, "lng": -122.4194},
    "radius": 5,
    "filters": {},
    "limit": 10
  }')
END_TIME=$(date +%s%N)
SECOND_CALL_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

echo "First call time: ${FIRST_CALL_TIME}ms"
echo "Second call time: ${SECOND_CALL_TIME}ms"

if [ $SECOND_CALL_TIME -lt $FIRST_CALL_TIME ]; then
  IMPROVEMENT=$(( (FIRST_CALL_TIME - SECOND_CALL_TIME) * 100 / FIRST_CALL_TIME ))
  echo -e "${GREEN}✓ Cache is working! ${IMPROVEMENT}% faster${NC}"
else
  echo -e "${YELLOW}⊘ Cache might not be working (or data is too small to measure)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Tests Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
