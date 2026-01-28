#!/bin/bash

# Test script for nearby-restaurants Edge Function
# Tests various scenarios with different filters

SUPABASE_URL="https://tqroqqvxabolydyznewa.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcm9xcXZ4YWJvbHlkeXpuZXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyNTQ5MDAsImV4cCI6MjA3MzgzMDkwMH0.wy8yzDPcyWwUDGwdM78-SE7zunEXxbyVGjP3s5ZdgH0"
FUNCTION_URL="${SUPABASE_URL}/functions/v1/nearby-restaurants"

echo "=================================="
echo "Testing nearby-restaurants Function"
echo "=================================="
echo ""

# Test 1: Basic search (New York City)
echo "Test 1: Basic search near NYC (40.7128, -74.0060)"
curl -s -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radiusKm": 10,
    "limit": 5
  }' | jq '.totalCount, .restaurants[0].name // "No restaurants found"'

echo ""
echo "---"
echo ""

# Test 2: With cuisine filter
echo "Test 2: Italian restaurants near NYC"
curl -s -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radiusKm": 10,
    "limit": 5,
    "filters": {
      "cuisines": ["Italian"]
    }
  }' | jq '.totalCount, .appliedFilters'

echo ""
echo "---"
echo ""

# Test 3: With dietary filters
echo "Test 3: Vegan-friendly restaurants"
curl -s -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radiusKm": 10,
    "limit": 5,
    "filters": {
      "dietaryTags": ["vegan"]
    }
  }' | jq '.totalCount, .restaurants[0].menus[0].dishes | length'

echo ""
echo "---"
echo ""

# Test 4: With allergen exclusion
echo "Test 4: Exclude peanut allergens"
curl -s -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radiusKm": 10,
    "limit": 5,
    "filters": {
      "excludeAllergens": ["peanuts"]
    }
  }' | jq '.totalCount'

echo ""
echo "---"
echo ""

# Test 5: Full response (pretty print)
echo "Test 5: Full response sample"
curl -s -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radiusKm": 5,
    "limit": 2
  }' | jq '.'

echo ""
echo "=================================="
echo "Tests completed!"
echo "=================================="
