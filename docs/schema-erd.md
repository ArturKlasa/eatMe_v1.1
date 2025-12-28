# Restaurant Database Schema - Complete ERD

Entity Relationship Diagram showing the complete database schema with restaurants, menus, and dishes.

## Complete Schema with Relationships

```mermaid
erDiagram
    RESTAURANTS ||--o{ MENUS : "has"
    RESTAURANTS ||--o{ DISHES : "offers"
    MENUS ||--o{ DISHES : "contains"

    RESTAURANTS {
        uuid id PK
        text name "NOT NULL"
        text restaurant_type "cafe, restaurant, fine_dining"
        geography location "PostGIS POINT - NOT NULL"
        text address "NOT NULL"
        text country_code "US, CA, MX, PL"
        text city
        text postal_code
        text phone
        text website
        text[] cuisine_types "Array of cuisines"
        jsonb open_hours "Operating hours by day"
        boolean delivery_available "Default: true"
        boolean takeout_available "Default: true"
        boolean dine_in_available "Default: true"
        boolean accepts_reservations "Default: false"
        text service_speed "fast-food, regular"
        numeric rating "0.00-5.00"
        text image_url
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    MENUS {
        uuid id PK
        uuid restaurant_id FK "NOT NULL, CASCADE DELETE"
        text name "NOT NULL"
        text description
        text category "all_day, breakfast, lunch, dinner, drinks, happy_hours"
        integer display_order "Default: 0"
        boolean is_active "Default: true"
        timestamptz created_at
        timestamptz updated_at
    }

    DISHES {
        uuid id PK
        uuid restaurant_id FK "NOT NULL, CASCADE DELETE"
        uuid menu_id FK "NULL, SET NULL on delete"
        text name "NOT NULL"
        text description
        numeric price "NOT NULL"
        text[] dietary_tags "vegan, vegetarian, gluten_free"
        text[] allergens "nuts, dairy, eggs, shellfish"
        text[] ingredients
        integer calories
        smallint spice_level "0-4, 0=none, 4=very spicy"
        text image_url
        boolean is_available "Default: true"
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## Relationship Details

### **RESTAURANTS → MENUS** (One-to-Many)

- One restaurant can have multiple menus (e.g., "Breakfast Menu", "Dinner Menu", "Drinks")
- **Cascade Delete**: Deleting a restaurant deletes all its menus
- Foreign Key: `menus.restaurant_id → restaurants.id`

### **RESTAURANTS → DISHES** (One-to-Many)

- One restaurant can offer multiple dishes
- **Cascade Delete**: Deleting a restaurant deletes all its dishes
- Foreign Key: `dishes.restaurant_id → restaurants.id`

### **MENUS → DISHES** (One-to-Many)

- One menu can contain multiple dishes
- **Set NULL on Delete**: Deleting a menu sets `dishes.menu_id` to NULL (dish remains, just unlinked)
- Foreign Key: `dishes.menu_id → menus.id`

---

## Implementation Status

### ✅ **Fully Implemented**

- ✅ All 3 tables created with complete schema
- ✅ Foreign key relationships with proper constraints
- ✅ PostGIS extension for geospatial queries
- ✅ Row Level Security (RLS) on all tables
- ✅ 16 indexes for optimal query performance
- ✅ Auto-update timestamps on all tables
- ✅ Cascade deletes configured
- ✅ Array fields for flexible data (cuisines, tags, allergens)

### 🎯 **Key Features**

**Indexes Created:**

- 7 indexes on `restaurants` (spatial, cuisine types, country, city, type, delivery, rating)
- 3 indexes on `menus` (restaurant_id, category, display_order)
- 6 indexes on `dishes` (restaurant_id, menu_id, dietary_tags, allergens, spice_level, price, availability)

**Data Types:**

- `GEOGRAPHY(POINT, 4326)` - PostGIS spatial type for location queries
- `TEXT[]` - PostgreSQL arrays for flexible multi-value fields
- `JSONB` - Structured JSON data for operating hours
- `NUMERIC(10,2)` - Precise decimal for prices
- `TIMESTAMPTZ` - Timezone-aware timestamps

---

## Future Extensions (Phase 3+)

```mermaid
erDiagram
    RESTAURANTS ||--o{ REVIEWS : "receives"
    DISHES ||--o{ REVIEWS : "receives"
    USERS ||--o{ REVIEWS : "writes"
    USERS ||--o{ FAVORITES : "saves"

    USERS {
        uuid id PK
        text email
        text name
        jsonb preferences
    }

    REVIEWS {
        uuid id PK
        uuid user_id FK
        uuid restaurant_id FK
        uuid dish_id FK
        integer rating
        text comment
    }

    FAVORITES {
        uuid id PK
        uuid user_id FK
        uuid restaurant_id FK
        uuid dish_id FK
    }
```

**Planned Features:**

- ⏳ User authentication and profiles
- ⏳ Restaurant and dish reviews/ratings
- ⏳ User favorites system
- ⏳ Search history and recommendations
