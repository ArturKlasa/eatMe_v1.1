# Ingredients Integration Guide

## 📦 Files Created

### API Layer

- **`lib/ingredients.ts`** - Complete API for ingredients, allergens, and dietary tags

### Components

- **`IngredientAutocomplete.tsx`** - Searchable ingredient selector with quantity input
- **`AllergenWarnings.tsx`** - Display allergen warnings with icons
- **`DietaryTagBadges.tsx`** - Show dietary classification badges

---

## 🔧 How to Integrate into Dish Forms

### Example: Add to Create/Edit Dish Form

```tsx
'use client';

import { useState, useEffect } from 'react';
import { IngredientAutocomplete } from '@/components/IngredientAutocomplete';
import { AllergenWarnings } from '@/components/AllergenWarnings';
import { DietaryTagBadges } from '@/components/DietaryTagBadges';
import {
  addDishIngredients,
  getDishAllergens,
  getDishDietaryTags,
  type Ingredient,
} from '@/lib/ingredients';

export function DishForm({ dishId }: { dishId?: string }) {
  const [selectedIngredients, setSelectedIngredients] = useState<
    (Ingredient & { quantity?: string })[]
  >([]);
  const [allergens, setAllergens] = useState([]);
  const [dietaryTags, setDietaryTags] = useState([]);

  // When form is submitted, save ingredients
  async function handleSubmit(formData: any) {
    // 1. Create/update dish first (existing code)
    const newDishId = await createDish(formData);

    // 2. Add ingredients to dish
    if (selectedIngredients.length > 0) {
      await addDishIngredients(
        newDishId,
        selectedIngredients.map(ing => ({
          ingredient_id: ing.id,
          quantity: ing.quantity,
        }))
      );

      // 3. Fetch auto-calculated allergens and dietary tags
      const { data: allergenData } = await getDishAllergens(newDishId);
      const { data: tagData } = await getDishDietaryTags(newDishId);

      setAllergens(allergenData || []);
      setDietaryTags(tagData || []);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Existing form fields (name, price, description, etc.) */}

      {/* NEW: Ingredients Section */}
      <div className="space-y-4">
        <label className="text-lg font-semibold">Ingredients</label>
        <IngredientAutocomplete
          selectedIngredients={selectedIngredients}
          onIngredientsChange={setSelectedIngredients}
          placeholder="Search and add ingredients..."
        />
      </div>

      {/* NEW: Real-time Allergen Warnings */}
      {allergens.length > 0 && <AllergenWarnings allergens={allergens} />}

      {/* NEW: Dietary Tag Badges */}
      {dietaryTags.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Dietary Classifications</label>
          <DietaryTagBadges dietaryTags={dietaryTags} />
        </div>
      )}

      <button type="submit">Save Dish</button>
    </form>
  );
}
```

---

## 🔄 Auto-Calculation Flow

### The Magic Happens Automatically!

```
1. User adds ingredients → IngredientAutocomplete updates state
2. Form submits → addDishIngredients() inserts to dish_ingredients table
3. Postgres Trigger runs automatically → Updates dishes.allergens & dishes.dietary_tags
4. Fetch updated values → getDishAllergens() & getDishDietaryTags()
5. Display warnings/badges → UI updates with allergen warnings and dietary badges
```

---

## 📍 Where to Add This

### Option 1: Onboarding Flow (apps/web-portal/app/onboard/menu/)

If dishes are created during onboarding, add the components there.

### Option 2: Restaurant Dashboard

If there's a separate dish management page, integrate there.

### Quick Find Command:

```bash
# Search for existing dish creation forms
find apps/web-portal -name "*.tsx" -type f | xargs grep -l "dish" | grep -i "form\|create\|edit"
```

---

## 🎨 Component API Reference

### `IngredientAutocomplete`

```tsx
<IngredientAutocomplete
  selectedIngredients={ingredients} // Current selection
  onIngredientsChange={setIngredients} // Update callback
  placeholder="Search ingredients..." // Optional
/>
```

### `AllergenWarnings`

```tsx
<AllergenWarnings
  allergens={allergens} // Array of Allergen objects
  className="mt-4" // Optional styling
/>
```

### `DietaryTagBadges`

```tsx
<DietaryTagBadges
  dietaryTags={tags} // Array of DietaryTag objects
  className="mt-2" // Optional styling
/>
```

---

## 🧪 Testing the Integration

### 1. Manual Test in Supabase Dashboard

```sql
-- Create a test dish
INSERT INTO dishes (name, menu_id, price)
VALUES ('Test Salad', '<your_menu_id>', 12.99)
RETURNING id;

-- Add ingredients (use IDs from ingredients_master)
INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity)
VALUES
  ('<dish_id>', (SELECT id FROM ingredients_master WHERE name = 'Lettuce'), '2 cups'),
  ('<dish_id>', (SELECT id FROM ingredients_master WHERE name = 'Cheese'), '50g'),
  ('<dish_id>', (SELECT id FROM ingredients_master WHERE name = 'Eggs'), '1');

-- Check auto-calculated values
SELECT name, allergens, dietary_tags FROM dishes WHERE id = '<dish_id>';
-- Should show allergens: ["milk", "eggs"]
-- Should show dietary_tags: ["vegetarian"]
```

### 2. Test in Web Portal

1. Navigate to dish creation form
2. Search for "tomato" → should see suggestions
3. Add 2-3 ingredients
4. Submit form
5. Check that allergen warnings appear
6. Check that dietary badges display correctly

---

## 🚀 Next Steps

1. **Find your dish form** (create/edit pages)
2. **Import the components** at the top
3. **Add state management** for selectedIngredients
4. **Integrate into form submission** using addDishIngredients()
5. **Display allergens/tags** after form submission or on edit page

Need help finding the dish form? Let me know and I can search for it!
