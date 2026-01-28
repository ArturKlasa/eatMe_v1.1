# Geospatial Integration Testing Guide

## ✅ What's Been Implemented

1. **Edge Function** - `nearby-restaurants` deployed to Supabase
2. **Mobile Service** - `geoService.ts` for API communication
3. **Store Integration** - `restaurantStore.ts` with geospatial methods
4. **UI Integration** - `BasicMapScreen.tsx` connected to geospatial search
5. **Error Handling** - Loading states and error alerts

## 🧪 How to Test

### 1. **Test Edge Function Directly**

```bash
cd /home/art/Documents/eatMe_v1/infra/supabase/functions
./test-nearby-restaurants.sh
```

Expected output:

```json
{
  "restaurants": [...],
  "totalCount": 5,
  "searchRadius": 5,
  "centerPoint": {"latitude": 40.7128, "longitude": -74.0060}
}
```

### 2. **Test Mobile App Integration**

#### Step 1: Start Metro Bundler

```bash
cd /home/art/Documents/eatMe_v1/apps/mobile
npm start
```

#### Step 2: Run on Android

```bash
npx expo run:android
```

#### Step 3: What to Expect

**On App Launch:**

1. ✅ Map loads with dark theme
2. ✅ "Finding nearby restaurants..." loading message appears
3. ✅ Location permission prompt (if first time)
4. ✅ Map auto-centers on your location
5. ✅ Restaurant markers appear within 5km radius
6. ✅ "X nearby" badge shows in top-right

**Filter Testing:**

1. Tap filter button (bottom-right)
2. Select a cuisine (e.g., "Italian")
3. ✅ Markers update to show only Italian restaurants
4. ✅ Distance calculation works (sorted by proximity)

**Error Testing:**

1. Turn off WiFi/Data
2. ✅ Error alert: "Unable to find nearby restaurants"
3. ✅ Falls back to cached data if available

### 3. **Verify Data Flow**

Check Metro console logs for:

```
[GeoService] Found 12 restaurants within 5km
[RestaurantStore] Loaded 12 nearby restaurants
BasicMapScreen: Using 12 nearby restaurants from geospatial search
```

### 4. **Performance Check**

- **Initial Load**: Should complete in < 3 seconds
- **Filter Update**: Should respond in < 500ms (server-side)
- **Location Refresh**: Should update markers within 1 second

## 🐛 Troubleshooting

### Issue: No restaurants showing

**Check:**

1. Database has restaurants with valid location data:
   ```sql
   SELECT id, name, location FROM restaurants LIMIT 5;
   ```
2. Location format is `{lat: number, lng: number}`
3. Restaurants are within 5km of your location

**Fix:**

```bash
# Test with a known location (New York City)
cd infra/supabase/functions
./test-nearby-restaurants.sh
```

### Issue: "Failed to fetch restaurants"

**Check:**

1. Supabase URL in `.env`: `EXPO_PUBLIC_SUPABASE_URL`
2. Supabase Anon Key in `.env`: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Edge Function deployed: https://supabase.com/dashboard/project/tqroqqvxabolydyznewa/functions

**Fix:**

```bash
cd /home/art/Documents/eatMe_v1/apps/mobile
cat .env | grep SUPABASE
```

### Issue: Location permission denied

**Fix:**

1. Go to device Settings > Apps > EatMe > Permissions
2. Enable "Location" permission
3. Restart app

### Issue: Map not centering on location

**Check Metro logs:**

```
Auto-centering map on user location...
Map auto-centered on user location: 40.7128, -74.0060
```

**Fix:**

- Ensure `hasPermission` is true
- Check `useUserLocation` hook is working

## 📊 Data Verification

### Check Edge Function Response

```bash
# Get function URL
echo "https://tqroqqvxabolydyznewa.supabase.co/functions/v1/nearby-restaurants"

# Test with curl
curl -X POST 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/nearby-restaurants' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"latitude": 40.7128, "longitude": -74.0060, "radiusKm": 5}'
```

### Check Database Restaurants

```sql
-- Count restaurants
SELECT COUNT(*) FROM restaurants;

-- Check location format
SELECT id, name, location FROM restaurants LIMIT 3;

-- Verify cuisine types
SELECT DISTINCT unnest(cuisine_types) as cuisine FROM restaurants;
```

## ✅ Success Criteria

- [ ] Edge Function returns valid JSON
- [ ] Mobile app loads without crashes
- [ ] Map shows restaurant markers
- [ ] Filters update markers correctly
- [ ] Distance badges show on markers
- [ ] Error handling works when offline
- [ ] Loading states display properly

## 🚀 Next Steps

After successful testing:

1. **Add More Restaurants** - Populate database with real data
2. **Optimize Radius** - Test different radius values (3km, 10km)
3. **Add Caching** - Implement local cache for offline mode
4. **Performance** - Add pagination if > 100 restaurants
5. **Analytics** - Track search radius vs. result count

## 📝 Notes

- **Default Radius**: 5km (configurable in `BasicMapScreen.tsx` line 275)
- **Max Results**: 50 restaurants (configurable in Edge Function)
- **Update Frequency**: On location change + filter change
- **Fallback**: Uses cached DB data if geospatial search fails
