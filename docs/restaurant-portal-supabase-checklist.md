# Restaurant Portal - Supabase Setup Checklist

**Date**: December 8, 2025  
**Focus**: Restaurant information only (no menus/dishes)

---

## ✅ Completed

- [x] Database schema designed (`002_restaurant_portal_schema.sql`)
- [x] Supabase client exists in `/packages/database`

---

## 📋 Setup Steps

### Step 1: Supabase Project Setup (User Action Required)

**Please provide:**

- [ ] Supabase Project URL: `https://____________.supabase.co`
- [ ] Supabase Anon Key: `eyJhbGc...`

**If you don't have a Supabase project yet:**

1. Go to [supabase.com](https://supabase.com)
2. Sign in with GitHub
3. Create new project
4. Save URL and anon key from Settings → API

---

### Step 2: Apply Database Migration

**Once we have credentials, we'll run:**

```bash
# Option A: Using Supabase Dashboard (easiest)
# 1. Copy contents of: infra/supabase/migrations/002_restaurant_portal_schema.sql
# 2. Go to SQL Editor in Supabase dashboard
# 3. Paste and run

# Option B: Using Supabase CLI
supabase db push
```

---

### Step 3: Install Dependencies in Web Portal

```bash
cd apps/web-portal
npm install @supabase/supabase-js
```

---

### Step 4: Create Environment File

**Create:** `apps/web-portal/.env.local`

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

### Step 5: Create Supabase Client

**Create:** `apps/web-portal/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface RestaurantInsert {
  name: string;
  restaurant_type: string;
  location: string; // PostGIS format: "POINT(lng lat)"
  address: string;
  country_code: string;
  cuisine_types: string[];
  phone?: string;
  website?: string;
  open_hours: Record<string, { open: string; close: string }>;
  delivery_available: boolean;
  takeout_available: boolean;
  dine_in_available: boolean;
  accepts_reservations: boolean;
  average_prep_time_minutes: number;
}
```

---

### Step 6: Update Review Page with Submission Logic

**Update:** `apps/web-portal/app/onboard/review/page.tsx`

Add submit button and handler (will implement after credentials are provided)

---

### Step 7: Test Connection

**Create:** `apps/web-portal/lib/test-supabase.ts`

```typescript
import { supabase } from './supabase';

export async function testConnection() {
  const { data, error } = await supabase.from('restaurants').select('count').limit(1);

  if (error) {
    console.error('❌ Connection failed:', error);
    return false;
  }

  console.log('✅ Supabase connected!');
  return true;
}
```

---

## 🎯 Current Status

**Waiting for:**

- Supabase project credentials (URL + anon key)

**Ready to implement:**

- Install dependencies
- Create client wrapper
- Add submission logic
- Test full flow

---

## 📊 Data Flow

```
User fills form
      ↓
LocalStorage (draft)
      ↓
Review page
      ↓
Click "Submit Restaurant"
      ↓
Transform data → Supabase format
      ↓
POST to Supabase
      ↓
Success → Clear LocalStorage
```

---

## 🔧 Data Transformation Required

### Location Format

```typescript
// Portal format
{ lat: 40.7128, lng: -74.0060 }

// Supabase format (PostGIS)
`POINT(-74.0060 40.7128)` // Note: lng first!
```

### Operating Hours

```typescript
// Portal format
{
  monday: { open: "09:00", close: "21:00", closed: false },
  tuesday: { open: "09:00", close: "21:00", closed: false }
}

// Supabase format (filter out closed days)
{
  monday: { open: "09:00", close: "21:00" },
  tuesday: { open: "09:00", close: "21:00" }
}
```

---

## ⏭️ Next Steps

Once you provide Supabase credentials, I'll:

1. ✅ Install @supabase/supabase-js
2. ✅ Create .env.local file
3. ✅ Create Supabase client wrapper
4. ✅ Add submission logic to review page
5. ✅ Test the connection
6. ✅ Verify first restaurant submission

**Ready when you are! Please provide your Supabase URL and anon key.**
