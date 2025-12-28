# Restaurant Schema Diagrams - Index

This document contains links to all database schema diagrams.

## 📊 All Diagrams in One File

**Main File**: [`restaurant-schema-diagram.md`](./restaurant-schema-diagram.md)

Contains all 8 diagrams with descriptions. Best viewed in:

- ✅ GitHub (auto-renders Mermaid)
- ✅ VS Code with "Markdown Preview Mermaid Support" extension
- ✅ Any Markdown viewer with Mermaid support

---

## 🎯 Individual Diagrams (Copy-Paste Ready)

### 1. Entity Relationship Diagram (ERD)

Shows complete table structure with all columns and data types.

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

---

### 2. Data Flow Diagram

Complete submission flow from form to database.

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

---

### 3. Data Transformation Flow

How portal data converts to Supabase format.

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

---

### 4. Row Level Security Policies

Permission flow for different user roles.

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

---

### 5. Trigger Workflow

Sequence diagram showing auto-update timestamp.

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

---

### 6. Complete System Architecture

End-to-end architecture from frontend to database.

```mermaid
graph TB
    subgraph "Frontend"
        FORM[Restaurant Form]
        STORAGE[LocalStorage]
        REVIEW[Review Page]
    end

    subgraph "API Layer"
        CLIENT[Supabase Client]
        TRANSFORM[Data Transformers]
    end

    subgraph "Backend"
        API[Supabase API]
        AUTH[Auth]
    end

    subgraph "Database"
        TABLE[(Restaurants)]
        POSTGIS[PostGIS]
        RLS[RLS]
        TRIGGERS[Triggers]
    end

    FORM -->|Auto-save| STORAGE
    STORAGE -->|Load| REVIEW
    REVIEW -->|Submit| CLIENT
    CLIENT --> TRANSFORM
    TRANSFORM -->|POST| API
    API --> AUTH
    AUTH --> RLS
    RLS --> TABLE
    TABLE --> POSTGIS
    TABLE --> TRIGGERS

    style FORM fill:#FFE4B5
    style TABLE fill:#98FB98
    style API fill:#87CEEB
```

---

## 📝 Quick Reference

| Diagram                 | Purpose                  | Best For                        |
| ----------------------- | ------------------------ | ------------------------------- |
| **ERD**                 | Complete table structure | Database design, documentation  |
| **Data Flow**           | Submission process       | Understanding user flow         |
| **Transformation**      | Data conversion          | Debugging data format issues    |
| **RLS Policies**        | Security permissions     | Understanding access control    |
| **Trigger Workflow**    | Auto-update mechanism    | Understanding database triggers |
| **System Architecture** | Full stack overview      | High-level understanding        |

---

## 🛠️ How to Use These Diagrams

### Option 1: View in GitHub

1. Push to GitHub
2. Open this file
3. Diagrams render automatically

### Option 2: VS Code

1. Install extension: "Markdown Preview Mermaid Support"
2. Open this file
3. Press `Ctrl+Shift+V` (or `Cmd+Shift+V` on Mac)
4. View rendered diagrams

### Option 3: Online Viewer

1. Go to https://mermaid.live
2. Copy one diagram at a time (including ```mermaid markers)
3. Paste into editor
4. View rendered diagram

### Option 4: Export Images

1. Use mermaid.live
2. Paste diagram
3. Click "Actions" → "Export" → "PNG/SVG"
4. Save image for presentations

---

## 📊 Schema Quick Stats

- **Columns**: 21 total (3 required, 18 optional)
- **Indexes**: 7 (1 GIST spatial, 1 GIN array, 5 BTREE)
- **RLS Policies**: 3 (SELECT, INSERT, UPDATE)
- **Triggers**: 1 (auto-update timestamp)
- **Extensions**: 2 (uuid-ossp, postgis)

---

## 🔗 Related Documentation

- [Quick Start Guide](./quick-start-supabase.md)
- [Integration Status](./supabase-integration-status.md)
- [Full Setup Guide](./supabase-setup.md)
- [Migration File](../infra/supabase/migrations/003_restaurant_portal_safe.sql)
