# Restaurant Portal Database Schema Diagram

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    RESTAURANTS {
        uuid id PK "Primary Key"
        text name "NOT NULL"
        text restaurant_type "cafe, restaurant, fine_dining, etc."
        geography location "PostGIS POINT(lng, lat) NOT NULL"
        text address "NOT NULL"
        text country_code "US, CA, MX, PL"
        text city
        text postal_code
        text phone
        text website
        text_array cuisine_types "Array of cuisines"
        jsonb open_hours "Operating hours by day"
        boolean delivery_available "Default: true"
        boolean takeout_available "Default: true"
        boolean dine_in_available "Default: true"
        boolean accepts_reservations "Default: false"
        integer average_prep_time_minutes "Default: 30"
        smallint price_level "1-4 ($-$$$$)"
        numeric rating "0.00-5.00"
        text image_url
        text description
        timestamptz created_at "Auto-generated"
        timestamptz updated_at "Auto-updated"
    }
```

## Data Flow Diagram

```mermaid
flowchart TD
    A[Web Portal Form] -->|User Input| B[LocalStorage]
    B -->|Auto-save| B
    B -->|Review Page| C{Validate Data}
    C -->|Invalid| D[Show Errors]
    D --> A
    C -->|Valid| E[Transform Data]
    E -->|Format Location| F[POINT lng lat]
    E -->|Filter Hours| G[Remove Closed Days]
    E -->|Prepare Payload| H[RestaurantInsert]
    H -->|HTTP POST| I[Supabase API]
    I -->|Insert Query| J[(Restaurants Table)]
    J -->|Success| K[Clear LocalStorage]
    K --> L[Redirect to Dashboard]
    J -->|Error| M[Show Error Toast]
    M --> A
```

## Data Transformation Flow

```mermaid
flowchart LR
    subgraph Portal["Web Portal Data"]
        A1[basicInfo.name]
        A2[basicInfo.location<br/>{lat lng}]
        A3[basicInfo.cuisines<br/>Array]
        A4[operations.operating_hours<br/>{day: {open close closed}}]
    end

    subgraph Transform["Transformation Layer"]
        B1[Direct Copy]
        B2[formatLocationForSupabase]
        B3[Array Passthrough]
        B4[formatOperatingHours]
    end

    subgraph Supabase["Supabase Format"]
        C1[name: TEXT]
        C2[location: GEOGRAPHY<br/>POINT lng lat]
        C3[cuisine_types: TEXT]
        C4[open_hours: JSONB<br/>{day: {open close}}]
    end

    A1 --> B1 --> C1
    A2 --> B2 --> C2
    A3 --> B3 --> C3
    A4 --> B4 --> C4
```

## Table Structure with Indexes

```mermaid
graph TB
    subgraph "Restaurants Table"
        TABLE[restaurants]

        subgraph "Primary Key"
            PK[id UUID]
        end

        subgraph "Required Fields"
            R1[name TEXT]
            R2[location GEOGRAPHY]
            R3[address TEXT]
        end

        subgraph "Optional Fields"
            O1[restaurant_type]
            O2[country_code]
            O3[phone website]
            O4[cuisine_types]
            O5[open_hours]
            O6[service options]
        end

        subgraph "Metadata"
            M1[created_at]
            M2[updated_at]
        end
    end

    subgraph "Indexes"
        I1[🗺️ GIST location_idx]
        I2[🏷️ GIN cuisine_types_idx]
        I3[🌍 BTREE country_code_idx]
        I4[🏙️ BTREE city_idx]
        I5[🏪 BTREE restaurant_type_idx]
        I6[📊 BTREE rating_idx]
    end

    TABLE --> PK
    TABLE --> R1
    TABLE --> R2
    TABLE --> R3
    TABLE --> O1
    TABLE --> O2
    TABLE --> O3
    TABLE --> O4
    TABLE --> O5
    TABLE --> O6
    TABLE --> M1
    TABLE --> M2

    R2 -.->|Spatial Query| I1
    O4 -.->|Array Query| I2
    O2 -.->|Filter| I3
    R3 -.->|Filter| I4
    O1 -.->|Filter| I5
```

## Row Level Security (RLS) Policies

```mermaid
flowchart TD
    subgraph "Restaurants Table RLS"
        TABLE[Restaurants Table<br/>RLS ENABLED]
    end

    subgraph "Roles"
        ANON[anon<br/>Anonymous Users]
        AUTH[authenticated<br/>Logged-in Users]
    end

    subgraph "Operations"
        SELECT[SELECT<br/>Read Data]
        INSERT[INSERT<br/>Submit Restaurant]
        UPDATE[UPDATE<br/>Edit Restaurant]
    end

    subgraph "Policies"
        P1["Public read access<br/>USING true"]
        P2["Public insert access<br/>WITH CHECK true"]
        P3["Authenticated update access<br/>USING true"]
    end

    ANON -->|Allowed| SELECT
    AUTH -->|Allowed| SELECT
    SELECT --> P1 --> TABLE

    ANON -->|Allowed| INSERT
    AUTH -->|Allowed| INSERT
    INSERT --> P2 --> TABLE

    AUTH -->|Allowed| UPDATE
    UPDATE --> P3 --> TABLE

    style P1 fill:#90EE90
    style P2 fill:#90EE90
    style P3 fill:#FFD700
```

## Trigger Workflow

```mermaid
sequenceDiagram
    participant Client
    participant Supabase
    participant Trigger
    participant Function
    participant Table

    Client->>Supabase: UPDATE restaurants SET name = 'New Name'
    Supabase->>Trigger: BEFORE UPDATE trigger fires
    Trigger->>Function: Execute update_updated_at_column()
    Function->>Function: NEW.updated_at = NOW()
    Function-->>Trigger: Return NEW row
    Trigger->>Table: Apply UPDATE with new timestamp
    Table-->>Supabase: Confirm update
    Supabase-->>Client: Return updated row

    Note over Function,Table: updated_at is automatically<br/>set to current timestamp
```

## Data Types Overview

```mermaid
mindmap
  root((Restaurants))
    Identification
      UUID id
      TEXT name
    Location
      GEOGRAPHY PostGIS
      TEXT address
      TEXT country_code
      TEXT city
    Classification
      TEXT restaurant_type
      TEXT[] cuisine_types
      SMALLINT price_level
    Contact
      TEXT phone
      TEXT website
    Operations
      JSONB open_hours
      BOOLEAN delivery
      BOOLEAN takeout
      BOOLEAN dine_in
      BOOLEAN reservations
      INTEGER prep_time
    Metrics
      NUMERIC rating
      TEXT image_url
      TEXT description
    Timestamps
      TIMESTAMPTZ created
      TIMESTAMPTZ updated
```

## Complete System Architecture

```mermaid
graph TB
    subgraph "Frontend - Next.js Web Portal"
        FORM[Restaurant Form<br/>React Components]
        STORAGE[LocalStorage<br/>Draft Data]
        REVIEW[Review Page<br/>Validation]
    end

    subgraph "API Layer"
        CLIENT[Supabase Client<br/>lib/supabase.ts]
        TRANSFORM[Data Transformers<br/>formatLocation<br/>formatHours]
    end

    subgraph "Supabase Backend"
        API[Supabase REST API<br/>Auto-generated]
        AUTH[Supabase Auth<br/>Optional]
    end

    subgraph "PostgreSQL Database"
        TABLE[(Restaurants Table)]
        POSTGIS[PostGIS Extension]
        RLS[Row Level Security]
        TRIGGERS[Update Triggers]
    end

    subgraph "Indexes"
        SPATIAL[GIST Spatial Index]
        ARRAY[GIN Array Index]
        BTREE[BTREE Standard Indexes]
    end

    FORM -->|Auto-save| STORAGE
    STORAGE -->|Load| REVIEW
    REVIEW -->|Submit| CLIENT
    CLIENT --> TRANSFORM
    TRANSFORM -->|HTTP POST| API
    API --> AUTH
    AUTH --> RLS
    RLS -->|Allow/Deny| TABLE
    TABLE --> POSTGIS
    TABLE --> TRIGGERS
    TABLE --> SPATIAL
    TABLE --> ARRAY
    TABLE --> BTREE

    style FORM fill:#FFE4B5
    style TABLE fill:#98FB98
    style API fill:#87CEEB
    style RLS fill:#FFD700
```

---

## Schema Statistics

- **Total Columns**: 21
- **Required Columns**: 3 (name, location, address)
- **Optional Columns**: 18
- **Indexes**: 7 (1 spatial, 1 GIN, 5 BTREE)
- **RLS Policies**: 3 (SELECT, INSERT, UPDATE)
- **Triggers**: 1 (auto-update timestamp)
- **Constraints**: 1 (price_level range check)

---

## Query Examples

### Spatial Query (Find Nearby Restaurants)

```sql
SELECT * FROM restaurants
WHERE ST_DWithin(
  location,
  ST_GeogFromText('POINT(-74.0060 40.7128)'),
  5000  -- 5km radius
);
```

### Filter by Cuisine

```sql
SELECT * FROM restaurants
WHERE 'Italian' = ANY(cuisine_types);
```

### Filter by Service Options

```sql
SELECT * FROM restaurants
WHERE delivery_available = true
  AND dine_in_available = true;
```

### Get Operating Hours for Monday

```sql
SELECT name, open_hours->'monday' as monday_hours
FROM restaurants
WHERE open_hours ? 'monday';
```
