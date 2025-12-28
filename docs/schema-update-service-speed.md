# Schema Update: Service Speed & Menu Categories

**Date**: December 28, 2025  
**Changes**:

1. Updated `service_speed` values from 'immediate'/'standard' to 'fast-food'/'regular'
2. Defined 6 menu categories for the `menus` table

---

## Changes Made

### 1. **Database Schema Updates**

#### Service Speed Field:

- ✅ `service_speed` (TEXT with constraint)
  - Values: `'fast-food'` or `'regular'` (updated from 'immediate'/'standard')
  - Constraint: `CHECK (service_speed IN ('fast-food', 'regular'))`

#### Menu Categories Defined:

- ✅ 6 standard categories for all restaurants:
  1. **all_day** - All-Day menu (available anytime)
  2. **breakfast** - Breakfast menu (morning)
  3. **lunch** - Lunch menu (midday)
  4. **dinner** - Dinner menu (evening)
  5. **drinks** - Beverages
  6. **happy_hours** - Happy Hours (special offers/discounts)

---

## Service Speed Options

### **Option 1: "fast-food"**

- Food is ready immediately or within minutes
- Examples: Fast food chains, grab-and-go, food trucks, quick-service cafes
- Minimal preparation time
- **User sees**: "Fast Food - Food ready immediately"

### **Option 2: "regular"**

- Food requires standard preparation time
- Examples: Sit-down restaurants, made-to-order dishes
- Typical 15-30 minute preparation
- **User sees**: "Regular Restaurant - Standard preparation time"

---

## Menu Categories

All restaurants can have up to 6 menu categories:

| Category        | Value         | Description             | Typical Time           |
| --------------- | ------------- | ----------------------- | ---------------------- |
| **All-Day**     | `all_day`     | Items available all day | Anytime                |
| **Breakfast**   | `breakfast`   | Morning menu            | 6am-11am               |
| **Lunch**       | `lunch`       | Midday menu             | 11am-3pm               |
| **Dinner**      | `dinner`      | Evening menu            | 5pm-10pm               |
| **Drinks**      | `drinks`      | Beverages only          | Anytime                |
| **Happy Hours** | `happy_hours` | Special offers          | Varies (e.g., 4pm-7pm) |

### **Example Restaurant Structure:**

```
Joe's Restaurant
├─ All-Day Menu
│  ├─ Coffee ($3)
│  ├─ Soda ($2)
│  └─ Fries ($4)
├─ Breakfast Menu
│  ├─ Pancakes ($8)
│  └─ Eggs Benedict ($12)
├─ Lunch Menu
│  ├─ Caesar Salad ($10)
│  └─ Club Sandwich ($11)
├─ Dinner Menu
│  ├─ Steak ($28)
│  └─ Salmon ($24)
├─ Drinks Menu
│  ├─ Wine ($8/glass)
│  └─ Cocktails ($12)
└─ Happy Hours
   ├─ Half-price appetizers
   └─ $5 cocktails
```

---

## Understanding CASCADE DELETE

### **What happens when you delete a restaurant?**

```sql
-- Restaurant with menus and dishes
Restaurant: "Joe's Pizza" (id: abc-123)
  ├─ Menu: "Lunch" (restaurant_id: abc-123)
  │    ├─ Dish: "Pepperoni Pizza" (menu_id: lunch-123, restaurant_id: abc-123)
  │    └─ Dish: "Margherita Pizza" (menu_id: lunch-123, restaurant_id: abc-123)
  └─ Menu: "Dinner" (restaurant_id: abc-123)
       └─ Dish: "Calzone" (menu_id: dinner-456, restaurant_id: abc-123)
```

**Delete the restaurant:**

```sql
DELETE FROM restaurants WHERE id = 'abc-123';
```

**Result with CASCADE DELETE:**

```
✅ Restaurant deleted
✅ Both menus deleted (because restaurant_id has CASCADE DELETE)
✅ All 3 dishes deleted (because restaurant_id has CASCADE DELETE)
```

### **What happens when you delete a menu?**

```sql
DELETE FROM menus WHERE id = 'lunch-123';
```

**Result with SET NULL:**

```
✅ "Lunch" menu deleted
✅ Pepperoni Pizza remains (menu_id set to NULL)
✅ Margherita Pizza remains (menu_id set to NULL)
```

The dishes still exist and belong to the restaurant, but are no longer associated with a specific menu.

---

## Database Migration Instructions

### **Apply the Updated Migration:**

```sql
-- Run this in Supabase SQL Editor
-- File: 004_complete_portal_schema.sql
```

Or if you need to update existing data:

```sql
-- Update service_speed constraint
ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_service_speed_check;
ALTER TABLE restaurants ADD CONSTRAINT restaurants_service_speed_check
  CHECK (service_speed IN ('fast-food', 'regular'));

-- Note: Existing data with old values needs manual update:
UPDATE restaurants
SET service_speed = CASE
  WHEN service_speed = 'immediate' THEN 'fast-food'
  WHEN service_speed = 'standard' THEN 'regular'
  ELSE service_speed
END
WHERE service_speed IN ('immediate', 'standard');
```

---

## TypeScript Types Updated

### **Service Speed:**

```typescript
export interface RestaurantOperations {
  service_speed?: 'fast-food' | 'regular'; // ✅ Updated
}
```

### **Menu Categories:**

```typescript
export const MENU_CATEGORIES = [
  { value: 'all_day', label: 'All-Day', description: 'Available all day' },
  { value: 'breakfast', label: 'Breakfast', description: 'Morning menu' },
  { value: 'lunch', label: 'Lunch', description: 'Midday menu' },
  { value: 'dinner', label: 'Dinner', description: 'Evening menu' },
  { value: 'drinks', label: 'Drinks', description: 'Beverages' },
  { value: 'happy_hours', label: 'Happy Hours', description: 'Special offers' },
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number]['value'];
```

---

## Form UI Implementation

### **Service Speed Radio Buttons:**

```tsx
<RadioGroup value={serviceSpeed} onValueChange={setServiceSpeed}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="fast-food" id="fast-food" />
    <Label htmlFor="fast-food">
      <div>Fast Food</div>
      <div className="text-sm text-gray-500">Food ready immediately</div>
    </Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="regular" id="regular" />
    <Label htmlFor="regular">
      <div>Regular Restaurant</div>
      <div className="text-sm text-gray-500">Standard preparation time</div>
    </Label>
  </div>
</RadioGroup>
```

### **Menu Category Selector:**

```tsx
<Select value={category} onValueChange={setCategory}>
  <SelectTrigger>
    <SelectValue placeholder="Select menu category" />
  </SelectTrigger>
  <SelectContent>
    {MENU_CATEGORIES.map(cat => (
      <SelectItem key={cat.value} value={cat.value}>
        <div>
          <div>{cat.label}</div>
          <div className="text-xs text-gray-500">{cat.description}</div>
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## Summary

### Updated Values ✅

- Service Speed: `'fast-food'` | `'regular'` (was 'immediate'/'standard')
- Menu Categories: 6 predefined options (all_day, breakfast, lunch, dinner, drinks, happy_hours)

### Cascade Behavior 🔄

- Delete Restaurant → Deletes all menus and dishes
- Delete Menu → Dishes remain but menu_id becomes NULL

### Files Modified

1. `/infra/supabase/migrations/003_restaurant_portal_safe.sql`
2. `/infra/supabase/migrations/004_complete_portal_schema.sql`
3. `/apps/web-portal/types/restaurant.ts`
4. `/apps/web-portal/lib/supabase.ts`
5. `/apps/web-portal/lib/constants.ts` (added MENU_CATEGORIES)
6. `/apps/web-portal/app/onboard/review/page.tsx`
7. `/docs/schema-erd.md`

**All TypeScript types are consistent!** ✅
