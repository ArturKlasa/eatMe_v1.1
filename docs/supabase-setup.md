# Supabase Setup Guide

**Project**: EatMe Restaurant Partner Portal  
**Date Created**: December 6, 2025  
**Purpose**: Backend database for restaurant data storage

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Database Schema](#database-schema)
5. [Web Portal Integration](#web-portal-integration)
6. [Data Flow](#data-flow)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture

```
┌─────────────────────┐
│   Web Portal        │
│   (Next.js)         │
│                     │
│ LocalStorage (draft)│
│        ↓            │
│   Review Page       │
│        ↓            │
│  Submit Button      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Supabase          │
│                     │
│  • restaurants      │
│  • menus            │
│  • dishes           │
│  • master data      │
└─────────────────────┘
```

### Purpose

- Store restaurant data submitted via web portal
- Provide validated data for mobile app (Phase 3)
- Enable restaurant partners to manage their information
- Support future authentication and authorization

---

## Prerequisites

### Required Accounts

- [ ] GitHub account (for Supabase login)
- [ ] Supabase account (free tier)

### Required Software

- [ ] Node.js 18+ installed
- [ ] Supabase CLI (optional but recommended)

### Install Supabase CLI

```bash
# macOS/Linux
npm install -g supabase

# Verify installation
supabase --version
```

---

## Initial Setup

### 1. Create Supabase Project (~5 min)

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" or "New Project"
3. Sign in with GitHub
4. Click "New Project"
5. Configure project:
   - **Name**: `eatme-production` (or `eatme-dev` for testing)
   - **Database Password**: Generate strong password (save securely!)
   - **Region**: Choose closest to your users (e.g., `us-east-1`)
   - **Pricing Plan**: Free (up to 500MB storage, 50K MAU)
6. Click "Create new project"
7. Wait ~2 minutes for provisioning

### 2. Save Project Credentials (~2 min)

Once project is created, go to **Settings** → **API**:

**Save these values securely:**

```bash
# Project URL
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Anon/Public Key (safe for client-side)
SUPABASE_ANON_KEY=eyJhbGc...

# Service Role Key (NEVER expose to client!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Project Reference ID
SUPABASE_PROJECT_REF=xxxxxxxxxxxxx
```

**Important Security Notes:**

- ⚠️ **Never commit** service role key to Git
- ✅ Anon key is safe for web portal (client-side)
- ✅ Use `.env.local` for local development
- ✅ Use Vercel environment variables for production

---

## Database Schema

### 3. Apply Database Migration (~5 min)

You have two options:

#### Option A: Using Supabase CLI (Recommended)

```bash
# Navigate to project root
cd /home/art/Documents/eatMe_v1

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref xxxxxxxxxxxxx

# Apply migration
supabase db push

# Verify tables created
supabase db diff
```

#### Option B: Using Supabase Dashboard (Manual)

1. Go to **SQL Editor** in Supabase dashboard
2. Create new query
3. Copy contents of `/infra/supabase/migrations/001_initial_schema.sql`
4. Paste into editor
5. Click "Run"
6. Verify no errors in output

### 4. Add Portal-Specific Columns (~3 min)

The portal collects additional fields not in the original schema. Add them:

**Go to SQL Editor and run:**

```sql
-- Add portal-specific columns to restaurants table
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS restaurant_type TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS average_prep_time_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS takeout_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS dine_in_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS accepts_reservations BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN restaurants.restaurant_type IS
  'Type of establishment: restaurant, fine_dining, cafe, food_truck, etc.';

COMMENT ON COLUMN restaurants.average_prep_time_minutes IS
  'Average preparation time in minutes (15=fast food, 30=regular)';
```

### 5. Verify Tables Created (~2 min)

**Go to Table Editor and verify these tables exist:**

- [x] `profiles` - User profiles with preferences
- [x] `restaurants` - Restaurant basic info and operations
- [x] `menus` - Menu categories
- [x] `dishes` - Individual dish items
- [x] `reviews` - User reviews and ratings
- [x] `favorites` - User favorite restaurants/dishes
- [x] `master_cuisines` - Cuisine type reference data
- [x] `master_dietary_tags` - Dietary tag reference data
- [x] `master_allergens` - Allergen reference data

**Check key columns in `restaurants` table:**

- `id` (UUID, primary key)
- `name` (TEXT)
- `location` (GEOGRAPHY - PostGIS point)
- `address` (TEXT)
- `country_code` (TEXT)
- `cuisine_types` (TEXT[])
- `open_hours` (JSONB)
- `restaurant_type` (TEXT) - ✨ newly added
- `phone` (TEXT) - ✨ newly added
- `website` (TEXT) - ✨ newly added

---

## Web Portal Integration

### 6. Install Supabase Client (~2 min)

```bash
cd apps/web-portal
npm install @supabase/supabase-js
```

### 7. Create Supabase Client (~3 min)

**Create file:** `apps/web-portal/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check .env.local');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper type for database
export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          name: string;
          location: string;
          address: string;
          country_code: string | null;
          cuisine_types: string[];
          // ... add other columns as needed
        };
        Insert: {
          name: string;
          location: string;
          address: string;
          country_code?: string;
          cuisine_types?: string[];
          // ... other fields
        };
        Update: {
          name?: string;
          location?: string;
          // ... partial updates
        };
      };
      // Add other tables as needed
    };
  };
};
```

### 8. Configure Environment Variables (~2 min)

**Create file:** `apps/web-portal/.env.local`

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Optional: Service role key for admin operations (NEVER expose to client)
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Add to `.gitignore`:**

```bash
# Environment files
.env.local
.env*.local
```

**For Vercel deployment**, add these as environment variables in:
Settings → Environment Variables

---

## Data Flow

### How Data Moves Through the System

#### 1. Draft Phase (LocalStorage)

```typescript
// User fills form → Auto-saves to LocalStorage
const saveProgress = (data: FormProgress) => {
  localStorage.setItem('eatme_restaurant_data', JSON.stringify(data));
};
```

#### 2. Review Phase (Validation)

```typescript
// User reviews data on /onboard/review page
const data = loadRestaurantData(); // from LocalStorage
// Display for verification
```

#### 3. Submission Phase (Supabase)

```typescript
// User clicks "Submit Restaurant"
const handleSubmit = async () => {
  const data = loadRestaurantData();

  // 1. Insert restaurant
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .insert({
      name: data.basicInfo.name,
      location: `POINT(${data.basicInfo.location.lng} ${data.basicInfo.location.lat})`,
      address: data.basicInfo.address,
      country_code: data.basicInfo.country,
      cuisine_types: data.basicInfo.cuisines,
      restaurant_type: data.basicInfo.restaurant_type,
      phone: data.basicInfo.phone,
      website: data.basicInfo.website,
      open_hours: data.operations.operating_hours,
      delivery_available: data.operations.delivery_available,
      takeout_available: data.operations.takeout_available,
      dine_in_available: data.operations.dine_in_available,
      average_prep_time_minutes: data.operations.average_prep_time_minutes,
      accepts_reservations: data.operations.accepts_reservations,
    })
    .select()
    .single();

  // 2. Insert menus (if any)
  if (data.menus?.length > 0) {
    await supabase.from('menus').insert(
      data.menus.map(menu => ({
        restaurant_id: restaurant.id,
        name: menu.name,
        description: menu.description,
        category: menu.category,
      }))
    );
  }

  // 3. Insert dishes (if any)
  if (data.dishes?.length > 0) {
    await supabase.from('dishes').insert(
      data.dishes.map(dish => ({
        menu_id: findMenuId(dish.menu_id),
        restaurant_id: restaurant.id,
        name: dish.name,
        description: dish.description,
        price: dish.price,
        dietary_tags: dish.dietary_tags,
        allergens: dish.allergens,
        ingredients: dish.ingredients,
      }))
    );
  }

  // 4. Clear LocalStorage on success
  localStorage.removeItem('eatme_restaurant_data');
};
```

### Data Transformation Examples

#### Location (Lat/Lng → PostGIS Point)

```typescript
// Portal format
const location = { lat: 40.7128, lng: -74.006 };

// Supabase format (PostGIS)
const postgisPoint = `POINT(${location.lng} ${location.lat})`;
// Note: PostGIS uses (longitude, latitude) order!
```

#### Operating Hours (Object → JSONB)

```typescript
// Portal format
const operatingHours = {
  monday: { open: '09:00', close: '21:00', closed: false },
  tuesday: { open: '09:00', close: '21:00', closed: false },
  // ...
};

// Supabase format - filter out closed days
const openHours = Object.entries(operatingHours)
  .filter(([_, hours]) => !hours.closed)
  .reduce(
    (acc, [day, hours]) => ({
      ...acc,
      [day]: { open: hours.open, close: hours.close },
    }),
    {}
  );
```

---

## Testing

### 1. Test Database Connection (~5 min)

**Create test file:** `apps/web-portal/lib/test-supabase.ts`

```typescript
import { supabase } from './supabase';

export async function testConnection() {
  try {
    // Test 1: Check connection
    const { data, error } = await supabase.from('restaurants').select('count').limit(1);

    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }

    console.log('✅ Supabase connection successful');

    // Test 2: Insert test restaurant
    const testRestaurant = {
      name: 'Test Restaurant',
      location: 'POINT(-74.0060 40.7128)', // NYC
      address: '123 Test St, New York, NY 10001',
      country_code: 'US',
      cuisine_types: ['American', 'Italian'],
      restaurant_type: 'restaurant',
    };

    const { data: inserted, error: insertError } = await supabase
      .from('restaurants')
      .insert(testRestaurant)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert failed:', insertError.message);
      return false;
    }

    console.log('✅ Test restaurant created:', inserted.id);

    // Test 3: Query test restaurant
    const { data: queried, error: queryError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', inserted.id)
      .single();

    if (queryError) {
      console.error('❌ Query failed:', queryError.message);
      return false;
    }

    console.log('✅ Test restaurant retrieved:', queried.name);

    // Test 4: Delete test restaurant
    const { error: deleteError } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', inserted.id);

    if (deleteError) {
      console.error('❌ Delete failed:', deleteError.message);
      return false;
    }

    console.log('✅ Test restaurant deleted');
    console.log('\n🎉 All tests passed!');

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}
```

**Run test:**

```bash
# Add to package.json scripts
"scripts": {
  "test:supabase": "tsx lib/test-supabase.ts"
}

# Install tsx if needed
npm install -D tsx

# Run test
npm run test:supabase
```

### 2. Test Full Submission Flow (~10 min)

1. Fill out restaurant form completely
2. Review data on review page
3. Open browser DevTools → Network tab
4. Click "Submit Restaurant" button
5. Watch for Supabase API calls
6. Check Supabase dashboard → Table Editor → restaurants
7. Verify new row appears with correct data

### 3. Verify Data Integrity

**Check in Supabase Dashboard:**

- [ ] Restaurant name matches form input
- [ ] Location is valid PostGIS point
- [ ] Cuisine types array is populated
- [ ] Operating hours JSONB is valid
- [ ] All boolean flags are set correctly
- [ ] Foreign keys link properly (menus → restaurants, dishes → menus)

---

## Troubleshooting

### Common Issues

#### 1. "Missing environment variables" Error

**Problem:** Supabase client can't find URL or anon key

**Solution:**

```bash
# Verify .env.local exists
ls -la apps/web-portal/.env.local

# Check variables are set
cat apps/web-portal/.env.local

# Restart dev server
npm run dev
```

#### 2. "Invalid API Key" Error

**Problem:** Anon key is incorrect or expired

**Solution:**

1. Go to Supabase Dashboard → Settings → API
2. Copy fresh anon key
3. Update `.env.local`
4. Restart server

#### 3. "Permission Denied" on Insert

**Problem:** Row Level Security (RLS) policies blocking insert

**Solution:**

```sql
-- Temporarily disable RLS for testing (re-enable later!)
ALTER TABLE restaurants DISABLE ROW LEVEL SECURITY;

-- Or create permissive policy
CREATE POLICY "Allow public insert"
ON restaurants
FOR INSERT
TO anon
WITH CHECK (true);
```

#### 4. PostGIS Point Format Error

**Problem:** Location format incorrect

**Solution:**

```typescript
// ❌ Wrong (lat, lng order)
const location = `POINT(${lat} ${lng})`;

// ✅ Correct (lng, lat order)
const location = `POINT(${lng} ${lat})`;
```

#### 5. JSONB Type Mismatch

**Problem:** Operating hours not saving correctly

**Solution:**

```typescript
// Ensure JSONB is valid JSON object
const openHours = JSON.parse(JSON.stringify(operatingHours));

// Or use type assertion
open_hours: operatingHours as any;
```

---

## Security Best Practices

### Environment Variables

✅ **DO:**

- Use `.env.local` for local development
- Add `.env.local` to `.gitignore`
- Use Vercel environment variables for production
- Keep service role key server-side only

❌ **DON'T:**

- Commit `.env.local` to Git
- Expose service role key to client
- Hardcode API keys in source code
- Share credentials in chat/email

### Row Level Security (RLS)

**Enable RLS for production:**

```sql
-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;

-- Create policy: Anyone can read, only authenticated can write
CREATE POLICY "Public read access"
ON restaurants
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated write access"
ON restaurants
FOR INSERT
TO authenticated
WITH CHECK (true);
```

---

## Next Steps

After setup is complete:

1. **Implement submission logic** in review page
2. **Test with sample data** (3-5 test restaurants)
3. **Add error handling** for network failures
4. **Create success/failure feedback** UI
5. **Deploy to Vercel** with environment variables
6. **Monitor usage** in Supabase dashboard

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostGIS Geometry Types](https://postgis.net/docs/geometry.html)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

---

## Support

**Issues or questions?**

- Check Supabase Discord: [discord.supabase.com](https://discord.supabase.com)
- Review migration file: `/infra/supabase/migrations/001_initial_schema.sql`
- Check existing database package: `/packages/database/README.md`

---

**Document Version:** 1.0  
**Last Updated:** December 6, 2025  
**Maintained By:** EatMe Development Team
