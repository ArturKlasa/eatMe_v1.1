# Quick Start: Connect Web Portal to Supabase

**5-Minute Setup Guide** 🚀

---

## Prerequisites

- ✅ Supabase client installed in web portal
- ✅ Database migration file ready
- ⏳ Supabase project credentials (get these below)

---

## Step 1: Get Supabase Credentials (2 min)

### Option A: Existing Project

1. Go to https://supabase.com/dashboard
2. Open your project
3. Click **Settings** (⚙️) → **API**
4. Copy:
   - **Project URL** (looks like: `https://abc123xyz.supabase.co`)
   - **anon public** key (starts with `eyJhbGc...`)

### Option B: New Project

1. Go to https://supabase.com
2. Click **Start your project**
3. Sign in with GitHub
4. Click **New Project**
5. Fill in:
   - **Name**: `eatme` or `eatme-dev`
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to you (e.g., US East)
6. Click **Create new project**
7. Wait ~2 minutes for provisioning
8. Go to **Settings** → **API** and copy credentials

---

## Step 2: Apply Database Migration (2 min)

### Using Supabase Dashboard (Recommended)

1. In your Supabase project, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open file: `/infra/supabase/migrations/002_restaurant_portal_schema.sql`
4. Copy ALL contents (Ctrl/Cmd + A, then Ctrl/Cmd + C)
5. Paste into SQL Editor
6. Click **Run** button or press Ctrl/Cmd + Enter
7. You should see: ✅ "Success. No rows returned"
8. Click **Table Editor** (left sidebar)
9. Verify `restaurants` table appears in tables list

**Troubleshooting**:

- If you see "permission denied", make sure you're logged in as project owner
- If you see "relation already exists", the table already exists (that's OK!)

---

## Step 3: Create Environment File (1 min)

### In Terminal:

```bash
cd apps/web-portal

# Create .env.local file
cat > .env.local << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=PASTE_YOUR_PROJECT_URL_HERE
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_YOUR_ANON_KEY_HERE
EOF

# Edit the file and replace with your actual credentials
nano .env.local  # or use your preferred editor
```

### Example (with fake credentials):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMzM2NzA2MCwiZXhwIjoxOTM4OTQzMDYwfQ.example_key
```

**Important**:

- Replace with YOUR actual values
- Don't use the example above!
- Double-check no extra spaces or quotes

---

## Step 4: Restart Dev Server

```bash
# Make sure you're in apps/web-portal
cd apps/web-portal

# Stop current dev server (Ctrl + C)
# Start dev server with new env variables
npm run dev
```

Server should start without errors. If you see Supabase error, check your `.env.local` file.

---

## Step 5: Test Submission (1 min)

1. Open browser: http://localhost:3000
2. Click **Restaurant Information**
3. Fill out the form completely:
   - Restaurant name (required)
   - Restaurant type (select one)
   - Address (required)
   - Click on map to set location (required)
   - Country (required)
   - Select at least 1 cuisine (required)
   - Fill other fields as desired
4. Click **Continue to Review**
5. Review all information
6. Click **Submit Restaurant Profile** button
7. Watch for:
   - ✅ Loading spinner appears
   - ✅ Success toast: "Restaurant information submitted successfully!"
   - ✅ Redirect to dashboard after 1.5 seconds

### Verify in Supabase:

1. Go back to Supabase Dashboard
2. Click **Table Editor** → **restaurants**
3. You should see your test restaurant!
4. Check that:
   - Name matches what you entered
   - Location shows coordinates
   - Cuisine types is an array
   - All other fields populated correctly

---

## ✅ Success Checklist

After completing above steps:

- [ ] Supabase project created
- [ ] Database migration applied
- [ ] `.env.local` file created with credentials
- [ ] Dev server running without errors
- [ ] Test restaurant submitted successfully
- [ ] Data visible in Supabase dashboard
- [ ] All fields match what you entered
- [ ] LocalStorage cleared after submission

**If all checked**, you're ready! 🎉

---

## 🐛 Troubleshooting

### "Missing Supabase environment variables" Error

**Problem**: `.env.local` not loaded or has wrong format

**Fix**:

```bash
# Check file exists
ls -la apps/web-portal/.env.local

# Check contents (should show your URL and key)
cat apps/web-portal/.env.local

# Restart dev server
npm run dev
```

### "Failed to submit" Error

**Check**:

1. Open browser DevTools (F12) → Console tab
2. Look for red error messages
3. Common issues:
   - **"Invalid API key"**: Check your anon key in `.env.local`
   - **"Network error"**: Check internet connection and Supabase project status
   - **"permission denied"**: RLS policy issue (run migration again)
   - **"syntax error"**: Location format issue (should be `POINT(lng lat)`)

### Data Not Appearing in Supabase

**Check**:

1. Supabase Dashboard → **Table Editor** → **restaurants**
2. Make sure you're looking at the correct project
3. Refresh the page
4. Check if table is empty (click table name to see rows)

### "Cannot read property of undefined" Error

**Likely Issue**: Form data incomplete

**Fix**:

1. Make sure all required fields filled:
   - Restaurant name ✓
   - Address ✓
   - Location on map ✓
   - At least 1 cuisine ✓
2. Try submitting again

---

## 🎯 Next Steps

**After successful test**:

1. **Submit Real Data**:
   - Fill out forms with actual restaurant information
   - Get real restaurants to submit their data
   - Build up your database

2. **Test More Features**:
   - Try different restaurant types
   - Test various cuisine combinations
   - Test operating hours for different schedules

3. **Add Menus** (Future):
   - Once comfortable with basic submissions
   - We can add menu/dish submission
   - Full restaurant profiles

---

## 📞 Need Help?

**If you're stuck**:

1. Check error messages in browser console (F12)
2. Check dev server terminal output
3. Share error message for specific help
4. Verify credentials are correct

**Common gotchas**:

- Forgot to restart dev server after creating `.env.local`
- Copied wrong anon key (service_role instead of anon)
- Extra spaces or quotes in environment variables
- Forgot to click on map to set location

---

**Ready to go!** 🚀

Just follow the 5 steps above and you'll have a working restaurant submission system connected to Supabase.
