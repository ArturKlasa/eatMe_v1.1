# Admin Dashboard UI Alignment Plan

**Goal:** Make admin dashboard for adding restaurants/menus/dishes look like the restaurant owner onboarding experience.

## Current State Analysis

### Restaurant Owner Onboarding (Reference):

- **Location:** `/onboard/basic-info` and `/onboard/menu`
- **Features:**
  - ✅ Beautiful gradient background (`from-orange-50 to-red-50`)
  - ✅ Clean Card components with icons
  - ✅ Organized sections with CardHeader/CardTitle/CardDescription
  - ✅ Visual cuisine selection with badges
  - ✅ Operating hours with checkboxes
  - ✅ Interactive LocationPicker map
  - ✅ Service options with checkboxes
  - ✅ DishFormDialog for adding dishes
  - ✅ DishCard for displaying dishes
  - ✅ Tabs for organizing menus
  - ✅ Better spacing and typography

### Admin Dashboard (Needs Update):

- **Location:** `/admin/restaurants/new`, `/admin/restaurants/[id]/menus/*`
- **Current Issues:**
  - ❌ Plain form without gradient background
  - ❌ Minimal styling
  - ❌ No icons in section headers
  - ❌ Basic input fields
  - ❌ Different dish/menu management UI
  - ❌ Doesn't use DishFormDialog or DishCard components

## Files to Update

### 1. Admin Restaurant Creation

**File:** `apps/web-portal/app/admin/restaurants/new/page.tsx`
**Changes:**

- Add gradient background
- Use Card components with icons
- Add cuisine selection UI (checkboxes + badges)
- Add operating hours section
- Add service options section
- Match styling to onboarding

### 2. Admin Restaurant Edit

**File:** `apps/web-portal/app/admin/restaurants/[id]/edit/page.tsx`
**Changes:**

- Same as new page but pre-populated with existing data

### 3. Admin Menu Management

**File:** `apps/web-portal/app/admin/restaurants/[id]/menus/page.tsx`
**Changes:**

- Use Tabs component like onboarding
- Show menus in tab list
- Use MenuCard component if exists or create similar UI

### 4. Admin Menu Creation/Edit

**Files:**

- `apps/web-portal/app/admin/restaurants/[id]/menus/new/page.tsx`
- `apps/web-portal/app/admin/restaurants/[id]/menus/[menuId]/edit/page.tsx`
  **Changes:**
- Use Card component with icon
- Better form layout
- Match onboarding styling

### 5. Admin Dish Management

**File:** `apps/web-portal/app/admin/restaurants/[id]/menus/[menuId]/dishes/page.tsx`
**Changes:**

- Use DishCard component (already exists)
- Use DishFormDialog for adding/editing
- Show dishes in grid layout like onboarding

### 6. Remove Separate Dish Pages (Optional)

**Files to potentially remove:**

- `apps/web-portal/app/admin/restaurants/[id]/menus/[menuId]/dishes/new/page.tsx`
- `apps/web-portal/app/admin/restaurants/[id]/menus/[menuId]/dishes/[dishId]/edit/page.tsx`

**Reason:** Use dialog/modal instead like onboarding

## Shared Components to Reuse

### Already Exist:

- ✅ `DishCard` - Display dishes
- ✅ `DishFormDialog` - Add/edit dishes
- ✅ `LocationPicker` - Map selection
- ✅ All UI components (Card, Badge, Checkbox, etc.)

### May Need to Create:

- MenuCard component (if not exists)
- RestaurantCard component (if not exists)

## Implementation Strategy

### Phase 1: Restaurant Pages

1. Update `/admin/restaurants/new/page.tsx`
2. Update `/admin/restaurants/[id]/edit/page.tsx`
3. Test creating and editing restaurants

### Phase 2: Menu Pages

1. Update `/admin/restaurants/[id]/menus/page.tsx`
2. Update `/admin/restaurants/[id]/menus/new/page.tsx`
3. Update `/admin/restaurants/[id]/menus/[menuId]/edit/page.tsx`
4. Test menu management

### Phase 3: Dish Pages

1. Update `/admin/restaurants/[id]/menus/[menuId]/dishes/page.tsx`
2. Integrate DishFormDialog and DishCard
3. Remove separate new/edit pages (use dialog instead)
4. Test dish management

## Key Design Patterns from Onboarding

### Background:

```tsx
<div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
```

### Card Header with Icon:

```tsx
<CardHeader>
  <CardTitle className="flex items-center gap-2">
    <Utensils className="h-5 w-5" />
    Basic Information
  </CardTitle>
  <CardDescription>General details about your restaurant</CardDescription>
</CardHeader>
```

### Cuisine Selection:

```tsx
// Selected badges
<div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
  {selectedCuisines.map(cuisine => (
    <Badge key={cuisine} variant="secondary">
      {cuisine}
      <button onClick={() => handleRemoveCuisine(cuisine)}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  ))}
</div>

// Checkboxes
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
  {cuisines.map(cuisine => (
    <div className="flex items-center space-x-2">
      <Checkbox id={cuisine} checked={selected.includes(cuisine)} />
      <label htmlFor={cuisine}>{cuisine}</label>
    </div>
  ))}
</div>
```

### Operating Hours:

```tsx
{
  DAYS_OF_WEEK.map(({ key, label }) => (
    <div key={key} className="flex items-center gap-4">
      <div className="w-28">
        <Label>{label}</Label>
      </div>
      <Checkbox id={`closed-${key}`} />
      <Label htmlFor={`closed-${key}`}>Closed</Label>
      <Input type="time" value={hours[key].open} className="w-32" />
      <span>to</span>
      <Input type="time" value={hours[key].close} className="w-32" />
    </div>
  ));
}
```

### Service Options:

```tsx
<div className="space-y-3">
  <div className="flex items-center space-x-3">
    <Checkbox id="delivery" />
    <Label htmlFor="delivery">Delivery Available</Label>
  </div>
  {/* More options */}
</div>
```

## Benefits of Alignment

1. **Consistency** - Same UI across owner and admin views
2. **Familiarity** - Easier for admins who are also restaurant owners
3. **Maintainability** - Reuse components instead of duplicate logic
4. **Better UX** - Polished onboarding UI is better designed
5. **Less Code** - Remove duplicate dish/menu forms

## Next Steps

Ready to implement Phase 1 (Restaurant Pages)?
