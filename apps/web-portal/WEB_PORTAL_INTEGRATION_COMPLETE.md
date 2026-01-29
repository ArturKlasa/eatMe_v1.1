# ✅ Web Portal Integration - Complete Guide

## 🎉 What's Been Done

### 1. **Updated `DishFormDialog.tsx`**

- ✅ Replaced text input with `IngredientAutocomplete` component
- ✅ Added real-time allergen warnings display
- ✅ Added auto-calculated dietary tag badges
- ✅ Ingredients are now searchable from `ingredients_master` table

### 2. **Created Components & API**

- ✅ `lib/ingredients.ts` - Complete API for ingredients
- ✅ `IngredientAutocomplete.tsx` - Searchable ingredient picker
- ✅ `AllergenWarnings.tsx` - Allergen warning display
- ✅ `DietaryTagBadges.tsx` - Dietary tag badges

---

## ⚠️ IMPORTANT: Data Flow Understanding

### Current Onboarding Flow (`apps/web-portal/app/onboard/menu/page.tsx`):

1. Menus/dishes saved to **LocalStorage** during onboarding
2. Final submission (`handleNext()`) saves everything to **Supabase**
3. Ingredients currently stored as `selectedIngredients` array in dish object

### What Needs To Happen:

When the onboarding form is finally submitted to Supabase, you need to:

1. **Create menus** in Supabase
2. **Create dishes** in Supabase
3. **Link ingredients** to dishes via `dish_ingredients` table ✨ **NEW**

---

## 🔧 Integration Steps

### Step 1: Update Final Submission Handler

Find the function that saves data to Supabase (likely in `apps/web-portal/app/onboard/review/page.tsx` or the final onboarding step). It probably looks like:

```typescript
// BEFORE (current)
async function submitToSupabase() {
  // 1. Create restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .insert({...})
    .select()
    .single();

  // 2. Create menus
  const { data: menuData } = await supabase
    .from('menus')
    .insert(menus)
    .select();

  // 3. Create dishes
  for (const menu of menuData) {
    const dishes = menusFromLocalStorage.find(m => m.id === menu.id)?.dishes;
    await supabase
      .from('dishes')
      .insert(dishes);
  }
}
```

### Step 2: Add Ingredient Linking

```typescript
// AFTER (with ingredients)
import { addDishIngredients } from '@/lib/ingredients';

async function submitToSupabase() {
  // 1. Create restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .insert({...})
    .select()
    .single();

  // 2. Create menus
  const { data: menuData } = await supabase
    .from('menus')
    .insert(menus)
    .select();

  // 3. Create dishes
  for (const menu of menuData) {
    const dishesFromLocalStorage = menusFromLocalStorage.find(m => m.id === menu.id)?.dishes;

    if (!dishesFromLocalStorage) continue;

    for (const dish of dishesFromLocalStorage) {
      // Insert dish
      const { data: createdDish } = await supabase
        .from('dishes')
        .insert({
          name: dish.name,
          price: dish.price,
          calories: dish.calories,
          spice_level: dish.spice_level,
          photo_url: dish.photo_url,
          is_available: dish.is_available,
          menu_id: menu.id,
          // Note: allergens and dietary_tags will auto-populate via trigger
        })
        .select()
        .single();

      // ✨ NEW: Link ingredients to dish
      if (dish.selectedIngredients && dish.selectedIngredients.length > 0) {
        await addDishIngredients(
          createdDish.id,
          dish.selectedIngredients.map(ing => ({
            ingredient_id: ing.id,
            quantity: ing.quantity,
          }))
        );

        // Trigger runs automatically in Postgres!
        // dishes.allergens and dishes.dietary_tags are now updated
      }
    }
  }
}
```

---

## 📝 Example: Complete Update for handleNext()

Here's what your `handleNext()` function should look like:

```typescript
const handleNext = async () => {
  if (!hasRestaurant) {
    toast.error('Please complete basic information first');
    router.push('/onboard/basic-info');
    return;
  }

  if (menus.length === 0) {
    toast.error('Please create at least one menu with dishes');
    return;
  }

  setIsSubmitting(true);

  try {
    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get restaurant data from localStorage
    const restaurantDraft = JSON.parse(localStorage.getItem(`eatme_draft_${user.id}`) || '{}');

    // 1. Create restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .insert({
        owner_id: user.id,
        name: restaurantDraft.name,
        // ... other fields
      })
      .select()
      .single();

    if (restaurantError) throw restaurantError;

    // 2. Create menus and dishes
    for (const menu of menus) {
      // Create menu
      const { data: createdMenu, error: menuError } = await supabase
        .from('menus')
        .insert({
          restaurant_id: restaurant.id,
          name: menu.name,
          description: menu.description,
        })
        .select()
        .single();

      if (menuError) throw menuError;

      // Create dishes for this menu
      for (const dish of menu.dishes) {
        const { data: createdDish, error: dishError } = await supabase
          .from('dishes')
          .insert({
            menu_id: createdMenu.id,
            name: dish.name,
            price: dish.price,
            calories: dish.calories,
            spice_level: dish.spice_level,
            photo_url: dish.photo_url,
            is_available: dish.is_available,
          })
          .select()
          .single();

        if (dishError) throw dishError;

        // ✨ Link ingredients to dish
        if ((dish as any).selectedIngredients?.length > 0) {
          const { error: ingredientsError } = await addDishIngredients(
            createdDish.id,
            (dish as any).selectedIngredients.map((ing: any) => ({
              ingredient_id: ing.id,
              quantity: ing.quantity,
            }))
          );

          if (ingredientsError) throw ingredientsError;
        }
      }
    }

    // Clear localStorage
    localStorage.removeItem(`eatme_draft_${user.id}`);
    localStorage.removeItem('eatme_restaurant_draft');

    toast.success('Restaurant created successfully!');
    router.push('/dashboard');
  } catch (error) {
    console.error('[Menu] Error submitting:', error);
    toast.error('Failed to create restaurant. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## 🧪 Testing the Complete Flow

### 1. **Test in Onboarding**

```
1. Go to /onboard/basic-info → Fill restaurant details
2. Go to /onboard/menu → Create menu
3. Add dish → Search for ingredients (e.g., "cheese", "tomato")
4. See allergen warnings appear (🥛 Milk, etc.)
5. See dietary tags auto-calculate (🥗 Vegetarian)
6. Submit form
7. Check Supabase Dashboard:
   - `dishes` table should have allergens & dietary_tags arrays
   - `dish_ingredients` table should have ingredient links
```

### 2. **Verify in SQL**

```sql
-- Check that dish has ingredients
SELECT * FROM dish_ingredients WHERE dish_id = '<your_dish_id>';

-- Check that allergens auto-calculated
SELECT name, allergens, dietary_tags FROM dishes WHERE id = '<your_dish_id>';

-- Should show:
-- allergens: ["milk", "eggs"]  (if dish has cheese/eggs)
-- dietary_tags: ["vegetarian"] (if all ingredients are vegetarian)
```

---

## 🎨 UI Demo

Your dish form now looks like this:

```
┌─────────────────────────────────────┐
│  Add New Dish                       │
├─────────────────────────────────────┤
│  Name: [Margherita Pizza________]   │
│  Price: [$16.99] Calories: [350_]   │
│                                     │
│  Ingredients                        │
│  [Search ingredients...         ]   │
│                                     │
│  ┌─────────────────────────────┐  │
│  │ 🥔 Tomato      | 2 cups | ❌ │  │
│  │ 🧀 Cheese      | 100g   | ❌ │  │
│  │ 🌿 Basil       | 5 leaves| ❌ │  │
│  └─────────────────────────────┘  │
│                                     │
│  ⚠️ Contains Allergens:             │
│  [🥛 Milk & Dairy]                  │
│                                     │
│  Auto-detected Tags:                │
│  [🥗 Vegetarian]                    │
│                                     │
│  [...rest of form...]               │
└─────────────────────────────────────┘
```

---

## 📌 Key Files Modified/Created

### Modified:

- ✅ `components/forms/DishFormDialog.tsx` - Added IngredientAutocomplete

### Created:

- ✅ `lib/ingredients.ts` - API functions
- ✅ `components/IngredientAutocomplete.tsx` - Autocomplete component
- ✅ `components/AllergenWarnings.tsx` - Allergen display
- ✅ `components/DietaryTagBadges.tsx` - Dietary tag display

### Need to Update:

- ⏳ `app/onboard/review/page.tsx` (or wherever final submission happens)
  - Add `addDishIngredients()` call when creating dishes

---

## 🚀 What's Left

1. **Find the final submission handler** - Look for where data is saved to Supabase
2. **Add ingredient linking** - Use the code example above
3. **Test the flow** - Create a dish through onboarding
4. **Verify in Supabase** - Check that dish_ingredients table is populated

Want me to find and update the final submission handler for you? Just let me know!
