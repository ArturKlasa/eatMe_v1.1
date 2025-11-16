# Restaurant Partner Portal

## Overview

The Restaurant Partner Portal is a web application designed to collect restaurant data before implementing the full backend infrastructure. This approach allows us to:

- Validate the data model with real restaurant information
- Collect structured data that matches our database schema
- Provide restaurants with an easy-to-use interface for data entry
- Export data in formats ready for database migration

## Strategic Approach

### Why Build This First?

1. **Data Validation**: Test our database schema with real-world data before committing to backend infrastructure
2. **User Testing**: Get feedback from restaurants on what information they can/want to provide
3. **Zero Cost MVP**: No backend costs during initial data collection phase
4. **Schema Refinement**: Identify missing fields or unnecessary complexity before database implementation
5. **Sales Tool**: Functional demo to attract restaurant partners

### Data Flow Strategy

**Phase 1 (Testing & Validation):**

```
Restaurant Partner Portal (Web Form)
    ↓
LocalStorage Persistence (auto-save drafts)
    ↓
Export JSON/CSV (for schema validation)
    ↓
Manual Review & Schema Testing
    ↓
Manual Import to Supabase (5-10 test restaurants)
```

**Phase 1.5+ (Production Ready):**

```
Restaurant Partner Portal (Web Form)
    ↓
LocalStorage (draft backup only)
    ↓
Submit Button → Direct to Supabase Database
    ↓
Admin Review Dashboard (approve/reject in web interface)
    ↓
Approved → Live in Mobile App
```

**Why This Approach?**

1. **Phase 1 Manual Export**: Tests our database schema with real restaurant data before committing to backend infrastructure. Allows us to refine field requirements and data validation without backend costs.

2. **Phase 1.5 Direct Submission**: Once schema is validated (after 5-10 test restaurants), we add direct Supabase integration. Restaurants submit directly to database, admins review in web dashboard, approved entries go live immediately.

3. **LocalStorage Role**: Always serves as auto-save/draft backup so restaurants don't lose work if they close the browser. Not the primary data storage.

## Implementation Phases

### Phase 1: Core Portal (15-20 hours)

**Goal**: Functional data collection with export capability for schema validation

**Strategy**: Build with LocalStorage + export for initial testing (5-10 restaurants), then add direct Supabase submission once schema is validated.

#### Features

- Multi-step wizard for restaurant onboarding
- LocalStorage-based auto-save (draft persistence)
- Export JSON/CSV (for initial schema testing)
- Basic validation and error handling
- Mobile-responsive design
- **Note**: Direct database submission added in Phase 1.5 (~2h additional work)

#### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: Shadcn/ui components
- **Forms**: React Hook Form + Zod validation
- **Storage**: Browser LocalStorage
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL JS (for address/location)

#### Pages/Steps

1. **Landing Page**
   - Portal overview
   - "Get Started" CTA
   - List of information needed
   - Estimated completion time (15-20 min)

2. **Step 1: Basic Information**
   - Restaurant name
   - Description
   - Address (with Mapbox geocoding)
   - Phone number
   - Website
   - Price range ($, $$, $$$, $$$$)
   - Cuisines (multi-select from master list)

3. **Step 2: Operations**
   - Operating hours (per day of week)
   - Delivery available (yes/no)
   - Takeout available (yes/no)
   - Dine-in available (yes/no)
   - Average prep time (minutes)

4. **Step 3: Menu Entry**
   - Add dishes (repeatable form)
   - For each dish:
     - Name
     - Description
     - Price
     - Dietary tags (vegetarian, vegan, gluten-free, etc.)
     - Allergens (multi-select)
     - Ingredients (comma-separated)
     - Photo upload (optional)
   - Bulk import option (CSV template)

5. **Step 4: Review & Submit**
   - Preview all entered data
   - Edit any section
   - Submission options:
     - **Phase 1**: Download JSON (matches database schema) + Download CSV
     - **Phase 1.5+**: Submit to Database button (primary action)
     - **Always**: Export JSON/CSV (backup option)
     - Print-friendly view
   - Clear form / Start new restaurant

#### Deliverables

- Fully functional web portal at `localhost:3000` or deployed to Vercel
- JSON export format matching Supabase schema
- CSV template for bulk menu imports
- Basic documentation for restaurant partners

#### Cost

- **$0** (localhost or free Vercel deployment)

---

### Phase 1.5: Direct Database Integration (2 hours) 🎯 CRITICAL ADDITION

**Goal**: Replace manual JSON export with direct Supabase submission

**When to Implement**: After 5-10 test restaurants validate the schema (no major field changes needed)

#### Features

- "Submit to Database" button on Step 4
- Direct POST to Supabase with Supabase client
- Submission confirmation and error handling
- Email notification to admin on new submission
- LocalStorage remains as draft backup only

#### Implementation

```typescript
// lib/supabase-submit.ts
import { getSupabaseClient } from '@/packages/database';

export async function submitRestaurantToDatabase(data: RestaurantData) {
  const supabase = getSupabaseClient();

  // Insert restaurant
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .insert({
      name: data.restaurant.name,
      description: data.restaurant.description,
      address: data.restaurant.address,
      location: `POINT(${data.restaurant.location.coordinates[0]} ${data.restaurant.location.coordinates[1]})`,
      phone: data.restaurant.phone,
      website: data.restaurant.website,
      price_range: data.restaurant.price_range,
      cuisines: data.restaurant.cuisines,
      // ... other fields
    })
    .select()
    .single();

  if (restaurantError) throw restaurantError;

  // Insert dishes
  const dishInserts = data.dishes.map(dish => ({
    restaurant_id: restaurant.id,
    name: dish.name,
    description: dish.description,
    price: dish.price,
    dietary_tags: dish.dietary_tags,
    allergens: dish.allergens,
    ingredients: dish.ingredients,
    photo_url: dish.photo_url,
  }));

  const { error: dishesError } = await supabase.from('dishes').insert(dishInserts);

  if (dishesError) throw dishesError;

  return restaurant;
}
```

#### User Flow Update

1. Restaurant completes 4-step wizard
2. Reviews data on Step 4
3. Clicks "Submit to Database" button
4. Success message: "Thank you! Your submission is under review."
5. Admin receives notification
6. Admin reviews in dashboard, approves/rejects
7. Approved restaurants appear in mobile app

#### Cost

- **$0** (Supabase free tier handles initial submissions)

---

### Phase 2: Enhanced UX (10 hours)

**Goal**: Improve usability and add convenience features

#### Features

- Restaurant dashboard (manage multiple locations)
- Save progress (multiple draft restaurants)
- Photo upload with preview and cropping
- Drag-and-drop for menu organization
- Duplicate dish functionality
- Auto-save every 30 seconds
- Form field suggestions (common cuisines, allergens)
- Validation feedback in real-time
- Progress indicator (% complete)

#### Tech Stack Additions

- **Image Handling**: react-image-crop or similar
- **Drag & Drop**: @dnd-kit/core
- **Auto-save**: Custom React hook with debounce

#### Deliverables

- Enhanced multi-restaurant management
- Better UX with auto-save and validation
- Image handling capabilities

#### Cost

- **$0** (still client-side only)

---

### Phase 3: Database Integration (TBD)

**Goal**: Connect portal to Supabase backend

#### Features

- User authentication (restaurant owner accounts)
- Direct save to Supabase database
- Real-time data sync
- Admin panel for data review/approval
- Restaurant profile editing
- Analytics dashboard (views, clicks)

#### Tech Stack Additions

- **Backend**: Supabase (existing schema)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (for images)
- **Admin**: Admin-only views with RLS policies

#### Migration Path

1. Import existing JSON exports into Supabase
2. Enable authentication (optional for existing restaurants)
3. Switch portal from LocalStorage to Supabase client
4. Implement RLS policies for restaurant data ownership

#### Cost

- **Supabase**: Free tier (500MB storage, 50,000 monthly active users)
- **Image CDN**: Included in Supabase Storage

---

## Data Model Alignment

### Export JSON Schema

The portal will export data in this structure, matching our Supabase schema:

```json
{
  "restaurant": {
    "name": "The Golden Spoon",
    "description": "Fine dining with locally sourced ingredients",
    "address": "123 Main St, San Francisco, CA 94102",
    "location": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749]
    },
    "phone": "+1-415-555-0123",
    "website": "https://goldespoon.com",
    "price_range": "$$$",
    "cuisines": ["Italian", "Mediterranean"],
    "average_prep_time_minutes": 30,
    "accepts_reservations": true,
    "delivery_available": true,
    "takeout_available": true,
    "operating_hours": {
      "monday": { "open": "11:00", "close": "22:00" },
      "tuesday": { "open": "11:00", "close": "22:00" },
      "wednesday": { "open": "11:00", "close": "22:00" },
      "thursday": { "open": "11:00", "close": "22:00" },
      "friday": { "open": "11:00", "close": "23:00" },
      "saturday": { "open": "10:00", "close": "23:00" },
      "sunday": { "open": "10:00", "close": "21:00" }
    }
  },
  "dishes": [
    {
      "name": "Margherita Pizza",
      "description": "Classic pizza with fresh mozzarella and basil",
      "price": 16.99,
      "dietary_tags": ["vegetarian"],
      "allergens": ["dairy", "gluten"],
      "ingredients": ["tomato", "mozzarella", "basil", "olive oil", "flour"],
      "photo_url": "data:image/jpeg;base64,..." // or external URL
    }
  ]
}
```

### Field Mapping to Database

| Portal Field       | Database Table | Database Column             | Type             |
| ------------------ | -------------- | --------------------------- | ---------------- |
| Restaurant Name    | `restaurants`  | `name`                      | TEXT             |
| Description        | `restaurants`  | `description`               | TEXT             |
| Address            | `restaurants`  | `address`                   | TEXT             |
| Location (lat/lng) | `restaurants`  | `location`                  | GEOGRAPHY(POINT) |
| Phone              | `restaurants`  | `phone`                     | TEXT             |
| Website            | `restaurants`  | `website`                   | TEXT             |
| Price Range        | `restaurants`  | `price_range`               | TEXT             |
| Cuisines           | `restaurants`  | `cuisines`                  | TEXT[]           |
| Avg Prep Time      | `restaurants`  | `average_prep_time_minutes` | INTEGER          |
| Operating Hours    | `restaurants`  | `operating_hours`           | JSONB            |
| Delivery Available | `restaurants`  | `delivery_available`        | BOOLEAN          |
| Takeout Available  | `restaurants`  | `takeout_available`         | BOOLEAN          |
| Dish Name          | `dishes`       | `name`                      | TEXT             |
| Dish Description   | `dishes`       | `description`               | TEXT             |
| Dish Price         | `dishes`       | `price`                     | DECIMAL          |
| Dietary Tags       | `dishes`       | `dietary_tags`              | TEXT[]           |
| Allergens          | `dishes`       | `allergens`                 | TEXT[]           |
| Ingredients        | `dishes`       | `ingredients`               | TEXT[]           |
| Photo              | `dishes`       | `photo_url`                 | TEXT             |

---

## Development Roadmap

### Getting Started (Phase 1)

#### 1. Project Setup (1 hour)

```bash
# Create Next.js app in monorepo
cd /home/art/Documents/eatMe_v1/apps
npx create-next-app@latest web-portal

# Options during setup:
# - TypeScript: Yes
# - ESLint: Yes
# - Tailwind CSS: Yes
# - App Router: Yes
# - Import alias: @/*

cd web-portal
```

#### 2. Install Dependencies (0.5 hours)

```bash
# UI Components
npx shadcn-ui@latest init

# Forms & Validation
pnpm add react-hook-form zod @hookform/resolvers

# Map Integration
pnpm add mapbox-gl react-map-gl
pnpm add -D @types/mapbox-gl

# Utilities
pnpm add date-fns clsx
```

#### 3. Shadcn Components to Install

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add select
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add label
npx shadcn-ui@latest add card
npx shadcn-ui@latest add form
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add badge
```

#### 4. Project Structure

```
apps/web-portal/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout
│   └── onboard/
│       ├── page.tsx                # Wizard container
│       ├── basic-info/page.tsx     # Step 1
│       ├── operations/page.tsx     # Step 2
│       ├── menu/page.tsx           # Step 3
│       └── review/page.tsx         # Step 4
├── components/
│   ├── ui/                         # Shadcn components
│   ├── wizard/
│   │   ├── WizardLayout.tsx        # Step navigation
│   │   ├── ProgressBar.tsx         # Progress indicator
│   │   └── StepIndicator.tsx       # Numbered steps
│   ├── forms/
│   │   ├── BasicInfoForm.tsx       # Step 1 form
│   │   ├── OperationsForm.tsx      # Step 2 form
│   │   ├── MenuForm.tsx            # Step 3 form
│   │   ├── DishCard.tsx            # Individual dish item
│   │   └── ReviewSection.tsx       # Step 4 review
│   └── map/
│       └── LocationPicker.tsx      # Mapbox address picker
├── lib/
│   ├── storage.ts                  # LocalStorage utilities
│   ├── validation.ts               # Zod schemas
│   ├── export.ts                   # JSON/CSV export logic
│   └── utils.ts                    # Helpers
├── types/
│   └── restaurant.ts               # TypeScript interfaces
└── public/
    └── templates/
        └── menu-import.csv         # CSV template
```

#### 5. Key Implementation Files

**`lib/validation.ts`** - Zod Schemas

```typescript
import { z } from 'zod';

export const basicInfoSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(5, 'Please enter a valid address'),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  price_range: z.enum(['$', '$$', '$$$', '$$$$']),
  cuisines: z.array(z.string()).min(1, 'Select at least one cuisine'),
});

export const dishSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(10),
  price: z.number().positive(),
  dietary_tags: z.array(z.string()),
  allergens: z.array(z.string()),
  ingredients: z.array(z.string()),
  photo_url: z.string().optional(),
});

// ... more schemas
```

**`lib/storage.ts`** - LocalStorage Wrapper

```typescript
const STORAGE_KEY = 'restaurant_portal_data';

export const saveRestaurantData = (data: any) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadRestaurantData = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearRestaurantData = () => {
  localStorage.removeItem(STORAGE_KEY);
};
```

**`lib/export.ts`** - Export Logic

```typescript
export const exportAsJSON = (data: any) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `restaurant-${data.restaurant.name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportAsCSV = (dishes: any[]) => {
  // CSV export logic for menu items
  const headers = ['Name', 'Description', 'Price', 'Dietary Tags', 'Allergens', 'Ingredients'];
  const rows = dishes.map(d => [
    d.name,
    d.description,
    d.price,
    d.dietary_tags.join('; '),
    d.allergens.join('; '),
    d.ingredients.join('; '),
  ]);

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  // ... download logic
};
```

---

## User Flow

### For Restaurant Partners

1. **Discovery**
   - Restaurant receives invitation email/link
   - Visits portal landing page
   - Reviews what information is needed (~15-20 min)

2. **Data Entry**
   - Clicks "Get Started"
   - Completes 4-step wizard:
     - Basic Info (5 min)
     - Operations (3 min)
     - Menu Entry (10-15 min)
     - Review (2 min)
   - Can save progress and return later

3. **Submission**
   - Reviews all information
   - **Phase 1**: Exports JSON file and sends via email
   - **Phase 1.5+**: Clicks "Submit to Database" button
   - Receives confirmation message

4. **Follow-up**
   - EatMe team reviews data
   - Contacts restaurant for clarifications if needed
   - Restaurant profile goes live in app

### For EatMe Team

**Phase 1 (Manual Export):**

1. **Data Collection**
   - Share portal link with 5-10 test restaurants
   - Receive JSON files via email

2. **Schema Validation**
   - Review JSON structure matches database schema
   - Identify missing/unnecessary fields
   - Test manual import to Supabase

3. **Schema Refinement**
   - Update database schema if needed
   - Adjust portal forms based on feedback

**Phase 1.5+ (Direct Submission):**

1. **Automated Collection**
   - Share portal link with restaurant partners
   - Monitor submissions in Admin Dashboard
   - Receive email notifications for new submissions

2. **Review & Approval**
   - Open submission in Admin Dashboard
   - Validate completeness and accuracy
   - Approve → Goes live in app
   - Reject → Contact restaurant for corrections

3. **Ongoing Management**
   - Monitor data quality metrics
   - Handle restaurant edit requests
   - Generate analytics reports

---

## Master Data Lists

### Cuisines

```typescript
const CUISINES = [
  'Afghan',
  'African',
  'American',
  'Argentine',
  'Asian Fusion',
  'BBQ',
  'Bakery',
  'Brazilian',
  'Breakfast',
  'British',
  'Café',
  'Cajun',
  'Caribbean',
  'Chinese',
  'Colombian',
  'Cuban',
  'Deli',
  'Dessert',
  'Ethiopian',
  'Fast Food',
  'Filipino',
  'French',
  'German',
  'Greek',
  'Halal',
  'Hawaiian',
  'Healthy',
  'Indian',
  'Indonesian',
  'Irish',
  'Italian',
  'Japanese',
  'Korean',
  'Kosher',
  'Latin American',
  'Lebanese',
  'Malaysian',
  'Mediterranean',
  'Mexican',
  'Middle Eastern',
  'Moroccan',
  'Nepalese',
  'Pakistani',
  'Peruvian',
  'Pizza',
  'Polish',
  'Portuguese',
  'Russian',
  'Salad',
  'Sandwiches',
  'Seafood',
  'Soul Food',
  'Soup',
  'Southern',
  'Spanish',
  'Steakhouse',
  'Sushi',
  'Tapas',
  'Thai',
  'Turkish',
  'Vegan',
  'Vegetarian',
  'Vietnamese',
];
```

### Dietary Tags

```typescript
const DIETARY_TAGS = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'keto',
  'paleo',
  'low-carb',
  'halal',
  'kosher',
  'organic',
  'raw',
  'whole30',
];
```

### Common Allergens

```typescript
const ALLERGENS = [
  'dairy',
  'eggs',
  'fish',
  'shellfish',
  'tree nuts',
  'peanuts',
  'wheat',
  'gluten',
  'soy',
  'sesame',
  'mustard',
  'celery',
  'lupin',
  'sulfites',
];
```

---

## Success Metrics

### Phase 1 Goals

- [ ] 10 restaurants complete the portal
- [ ] Average completion time < 20 minutes
- [ ] 90%+ data completeness (all required fields filled)
- [ ] Zero data loss (LocalStorage + export working)
- [ ] 5+ pieces of feedback for UX improvements

### Phase 2 Goals

- [ ] 50+ restaurants onboarded
- [ ] Average of 15+ dishes per restaurant
- [ ] 50%+ upload photos for dishes
- [ ] Auto-save prevents data loss incidents
- [ ] Restaurant dashboard used by 80%+ of partners

### Phase 3 Goals

- [ ] 100% of portal data migrated to Supabase
- [ ] Real-time sync working for new submissions
- [ ] Restaurant partners can edit their profiles
- [ ] Admin approval workflow active

---

## Future Enhancements

### Advanced Features (Post-Phase 3)

- Multi-language support (Spanish, Chinese, etc.)
- Rich text editor for descriptions
- Menu categorization (appetizers, mains, desserts)
- Seasonal menu toggles
- Special offers/promotions section
- Partner analytics (profile views, dish popularity)
- Integration with POS systems
- API for third-party menu management tools

### AI-Powered Features

- Auto-generate dish descriptions from photos
- Allergen detection from ingredient lists
- Cuisine classification from menu items
- Price optimization suggestions
- Menu translation services

---

## Technical Considerations

### Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- LocalStorage support required
- JavaScript enabled
- Minimum screen width: 375px (mobile)

### Data Privacy

- No personal data stored in LocalStorage
- Restaurant business information only
- Clear data retention policy
- Option to clear/delete data anytime

### Performance

- Target load time: < 2 seconds
- Form validation: Real-time (debounced)
- Auto-save interval: 30 seconds
- Max JSON export size: 5MB

### Security

- Input sanitization (XSS prevention)
- File upload validation (image types only)
- Rate limiting on form submissions (Phase 3)
- HTTPS required for production

---

## Deployment

### Phase 1 Deployment Options

1. **Vercel (Recommended)**

   ```bash
   # Install Vercel CLI
   pnpm add -g vercel

   # Deploy
   cd apps/web-portal
   vercel --prod
   ```

   - **Cost**: Free tier (100GB bandwidth/month)
   - **Custom domain**: Yes (free SSL)
   - **Deploy time**: < 2 minutes

2. **Netlify**
   - Similar to Vercel
   - Drag-and-drop deployment
   - Free tier available

3. **Self-hosted**
   - Build static export: `next build && next export`
   - Host on any static file server
   - Requires manual updates

### Environment Variables

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx...
NEXT_PUBLIC_APP_URL=https://partners.eatme.app
```

---

## FAQ for Restaurant Partners

**Q: How long does it take to complete?**
A: About 15-20 minutes for basic information and 10-15 menu items.

**Q: Can I save my progress?**
A: Yes! Your data is automatically saved in your browser. You can close the page and return later.

**Q: What if I have 100+ menu items?**
A: We provide a CSV template for bulk upload. Add your items in Excel/Sheets and upload.

**Q: Do I need to create an account?**
A: Not in Phase 1. Just fill out the form and export your data.

**Q: What happens to my data?**
A: You submit it directly through the portal. Our team reviews it within 48 hours and adds your restaurant to the EatMe app once approved.

**Q: Can I edit my information later?**
A: In Phase 3, you'll be able to log in and edit your profile anytime.

**Q: Is there a cost?**
A: No, the portal is completely free for restaurants.

---

## Contact & Support

- **Questions**: partners@eatme.app
- **Technical Issues**: support@eatme.app
- **Partnership Inquiries**: hello@eatme.app

---

## Changelog

- **2024-11-16**: Initial documentation created
- **2024-11-16**: Updated data flow strategy to clarify Phase 1 (export for testing) vs Phase 1.5 (direct submission)
- **TBD**: Phase 1 implementation started (LocalStorage + export)
- **TBD**: Phase 1 testing with 5-10 restaurants
- **TBD**: Phase 1.5 direct database integration (2h)
- **TBD**: Phase 2 enhanced UX features
- **TBD**: Phase 3 full authentication and admin tools
