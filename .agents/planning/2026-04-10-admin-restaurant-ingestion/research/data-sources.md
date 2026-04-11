# Research: Restaurant Data Sources

## Overview

This document surveys the available approaches for acquiring restaurant data (name, address, cuisine, hours, menu, etc.) at scale for admin ingestion.

---

## 1. Google Places API (New)

**What it provides:** Name, address, lat/lng, phone, website, opening hours, cuisine/types, ratings, photos, and (new) structured menu data via `businessMenus` field mask.

**How it works:**
- **Text Search**: Query "restaurants in [city]" → returns up to 20 results per page, paginated via `nextPageToken`
- **Place Details**: Fetch full details per place by `place_id`
- Field masking controls cost — request only the fields you need

**Pricing (pay-as-you-go, $200/mo free credit):**
| SKU Tier | Cost per 1,000 requests |
|----------|------------------------|
| IDs Only | $0 |
| Location | $5 |
| Basic (name, address, type) | $32 |
| Advanced (hours, phone, website) | $35 |
| Preferred (reviews, menu) | $40 |

**Bulk cost estimate (1,000 restaurants in a city):**
- ~50 Text Search requests (20 results each) × $0.032 = ~$1.60
- 1,000 Place Details (Advanced) × $0.035 = ~$35
- **Total: ~$37 for 1,000 restaurants with hours, address, phone, website**
- With menu data (Preferred): ~$42

**Pros:**
- Most comprehensive and accurate data globally
- Structured menu data available (new feature)
- Geocoded coordinates included
- Official API, legally clean
- $200/mo free credit covers ~5,700 Advanced detail lookups

**Cons:**
- Per-request billing adds up at scale
- Max 20 results per Text Search page (pagination needed)
- Terms prohibit caching/storing data long-term without displaying Google attribution
- No true "bulk download" — must iterate through search + details

**References:**
- [Places API Overview](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Place Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Pricing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)

---

## 2. Foursquare Places API

**What it provides:** Name, address, lat/lng, categories, hours, ratings (10-point scale), photos, tips. 105M+ global POIs.

**How it works:**
- Place Search → returns venues matching query + location
- Place Details → full venue data by `fsq_id`

**Pricing:**
| Tier | Cost | Free Allowance |
|------|------|----------------|
| Pro (search, details, basic fields) | $15 / 1,000 calls | 10,000 calls/mo |
| Premium (hours, ratings, photos, tips) | $18.75 / 1,000 calls | None |

**Bulk cost estimate (1,000 restaurants):**
- Search calls: covered by free tier
- 1,000 Premium detail calls: ~$18.75
- **Total: ~$19 for 1,000 restaurants with hours and ratings**

**Pros:**
- Good global coverage (105M POIs)
- 10,000 free Pro calls/month
- Clean category taxonomy
- No Google attribution requirements

**Cons:**
- Premium endpoints (hours, ratings) have NO free tier
- Less comprehensive than Google for menu data
- No structured menu data

**References:**
- [Foursquare Places API](https://foursquare.com/products/places-api/)
- [Pricing](https://foursquare.com/pricing/)

---

## 3. Yelp Fusion / Places API

**What it provides:** Name, address, phone, hours, categories, rating (5-star), review count, photos, price range.

**How it works:**
- Business Search: up to 240 results per query
- Business Details: full data per `business_id`

**Pricing:**
- 5,000 free API calls during 30-day trial
- Paid plans priced per API call (tiered monthly plans)
- Exact pricing requires contacting sales

**Pros:**
- Rich review data
- Good US coverage
- Categories map well to cuisine types

**Cons:**
- Limited international coverage (US-focused + select cities)
- Paid plans required for production use
- No structured menu data
- Terms restrict data storage

**References:**
- [Yelp Places API](https://business.yelp.com/data/products/places-api/)
- [Yelp Pricing](https://business.yelp.com/data/resources/pricing/)

---

## 4. OpenStreetMap (Overpass API)

**What it provides:** Name, address, lat/lng, cuisine tags, opening_hours, amenity type. Community-maintained.

**How it works:**
- Overpass QL query: `[out:json]; area["name"="Berlin"]->.a; nwr["amenity"="restaurant"](area.a); out center;`
- Returns all tagged restaurants in the area with available metadata
- Export as JSON, GeoJSON, CSV

**Pricing:** **Free** (open data, ODbL license)

**Data quality:**
- Varies hugely by region — excellent in Europe, patchy in US suburbs
- Tags available: `name`, `addr:*`, `cuisine`, `opening_hours`, `phone`, `website`, `diet:*`
- Many restaurants lack hours or cuisine tags
- No menu data, no ratings

**Bulk cost estimate:** $0

**Pros:**
- Completely free, open license (ODbL)
- No rate limits for reasonable use
- Good coverage in European cities
- Coordinates included
- Can query entire cities in one request

**Cons:**
- Incomplete data — many restaurants missing hours, cuisine, phone
- No menu data
- No ratings or reviews
- Data quality varies dramatically by region
- Community-maintained = unpredictable updates

**References:**
- [Overpass API Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Restaurant tag](https://wiki.openstreetmap.org/wiki/Tag:amenity=restaurant)

---

## 5. Google Maps Scraping Services (Outscraper, Apify, Scrap.io)

**What they provide:** Full Google Maps business data extracted via scraping — name, address, phone, hours, ratings, reviews, photos, menu links.

**How it works:**
- Provide search query (e.g., "restaurants in Warsaw")
- Service scrapes Google Maps results
- Export as CSV, JSON, Excel

**Pricing (Outscraper):**
| Tier | Cost per 1,000 records |
|------|----------------------|
| Free tier | First 500 records free |
| Up to 100K records | $3 / 1,000 |
| 100K+ records | $1 / 1,000 |

**Bulk cost estimate (1,000 restaurants):** ~$3

**Pros:**
- Cheapest option for rich data
- Gets same data as Google Places API
- CSV export ready to use
- No API integration needed
- Includes hours, ratings, reviews

**Cons:**
- **Violates Google's Terms of Service** (though legally grey — courts have ruled scraping public data is legal in US)
- Data freshness depends on scrape timing
- No structured menu data (just menu URL links)
- Risk of service disruption if Google changes their frontend
- No real-time updates

**References:**
- [Outscraper Google Maps Scraper](https://outscraper.com/google-maps-scraper/)
- [Outscraper Pricing](https://outscraper.com/pricing/)
- [Apify Google Maps Scraper](https://apify.com/compass/crawler-google-places)
- [Legal analysis](https://scrap.io/scrape-google-gaps-legal)

---

## 6. Food Delivery Platform Data (Zomato, OpenMenu, Foodspark)

**What they provide:** Restaurant name, cuisine, address, hours, **full menu data** (dish names, prices, descriptions).

**Zomato API:**
- Listings, daily menus, reviews, cuisines, average cost
- Good coverage in India, UAE, select other markets

**OpenMenu:**
- 550K+ menus, 25M+ menu items
- Structured menu data (dish name, price, description)
- US-focused

**Foodspark:**
- Aggregates data from Uber Eats, DoorDash, Grubhub, Swiggy
- Custom data APIs
- Pricing: custom/enterprise

**Pros:**
- Structured menu data (the only sources with it besides Google)
- Good for dish-level ingestion

**Cons:**
- Coverage varies by platform and region
- Enterprise pricing for most
- May have licensing restrictions on data usage

**References:**
- [OpenMenu API](https://openmenu.com/api/)
- [Foodspark](https://www.foodspark.io/food-data-api-providers-2026/)

---

## 7. Manual / Admin-Curated Entry

**What it provides:** Whatever the admin types in.

**How it works:** Current approach — admin fills form per restaurant.

**Cost:** Admin time only (~5-10 min per restaurant)

**Pros:**
- Complete control over data quality
- No licensing concerns
- Can include custom fields

**Cons:**
- Doesn't scale (100 restaurants = 8-17 hours of work)
- Error-prone (typos, inconsistent formats)
- No menu data unless manually entered

---

## Comparison Matrix

| Source | Cost (1K restaurants) | Cuisine | Hours | Menu | Coordinates | Quality | Legal Risk |
|--------|----------------------|---------|-------|------|-------------|---------|------------|
| Google Places API | ~$37 | ✅ | ✅ | ✅ (new) | ✅ | High | None |
| Foursquare API | ~$19 | ✅ | ✅ | ❌ | ✅ | High | None |
| Yelp API | Paid plans | ✅ | ✅ | ❌ | ✅ | High (US) | None |
| OpenStreetMap | Free | Partial | Partial | ❌ | ✅ | Variable | None |
| Outscraper/Apify | ~$3 | ✅ | ✅ | ❌ | ✅ | High | Medium (ToS) |
| OpenMenu | Custom | ✅ | ❌ | ✅ | ❌ | Medium | None |
| Manual entry | Time only | ✅ | ✅ | ✅ | ✅ (map) | Varies | None |

---

## Recommended Approach

**Hybrid strategy:**

1. **Primary: Google Places API** — Use Text Search to find restaurants in target areas, then Place Details for full data. The $200/mo free credit covers ~5,700 lookups. Legally clean, best data quality, includes coordinates and hours.

2. **Supplement: OpenStreetMap** — Free bulk seed data for initial coverage, especially in European cities. Use as a starting point, then enrich via Google Places API.

3. **Menu data: Existing GPT-4o menu scanner** — Continue using the current image-based menu extraction. Optionally add Google Places menu data as a secondary source.

4. **Fallback: Manual quick-add** — For restaurants not found in any API, provide a streamlined admin form.

**Pipeline concept:**
```
Admin selects target area (city/neighborhood)
  → Query Google Places API for restaurants in area
  → Parse results into standard format
  → Preview & deduplicate against existing DB
  → Admin reviews, selects restaurants to import
  → Batch insert into DB
  → For each imported restaurant: option to run menu scanner
```
