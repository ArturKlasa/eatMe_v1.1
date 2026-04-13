import Papa from 'papaparse';
import type { MappedRestaurant, ImportError } from '@/lib/import-types';

export interface ParseResult {
  restaurants: MappedRestaurant[];
  parseErrors: ImportError[];
}

// Required columns that must be present in the CSV header
const REQUIRED_COLUMNS = ['name', 'latitude', 'longitude'] as const;

// Day name to open_hours key mapping
const DAY_MAP: Record<string, string> = {
  mon_hours: 'monday',
  tue_hours: 'tuesday',
  wed_hours: 'wednesday',
  thu_hours: 'thursday',
  fri_hours: 'friday',
  sat_hours: 'saturday',
  sun_hours: 'sunday',
};

function parseHoursString(raw: string | undefined): { open: string; close: string } | null {
  if (!raw || raw.trim() === '') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'closed') return null;
  const match = trimmed.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!match) return null;
  return { open: match[1], close: match[2] };
}

/**
 * Parse CSV text to MappedRestaurant objects.
 * @param csvText
 
 * @returns*/
export function parseCsvToRestaurants(csvText: string): ParseResult {
  const restaurants: MappedRestaurant[] = [];
  const parseErrors: ImportError[] = [];

  const text = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    result.errors.forEach((e, i) => {
      parseErrors.push({
        index: typeof e.row === 'number' ? e.row : i,
        message: `CSV parse error: ${e.message}`,
      });
    });
    if (result.data.length === 0) {
      return { restaurants, parseErrors };
    }
  }

  const headers = result.meta.fields ?? [];
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      parseErrors.push({
        index: 0,
        field: col,
        message: `Missing required column: "${col}"`,
      });
    }
  }
  if (
    parseErrors.some(
      e => e.field && REQUIRED_COLUMNS.includes(e.field as (typeof REQUIRED_COLUMNS)[number])
    )
  ) {
    return { restaurants, parseErrors };
  }

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];

    const name = row['name']?.trim();
    if (!name) {
      parseErrors.push({ index: i, field: 'name', message: 'Row is missing required field: name' });
      continue;
    }

    const lat = parseFloat(row['latitude'] ?? '');
    const lng = parseFloat(row['longitude'] ?? '');
    if (isNaN(lat) || isNaN(lng)) {
      parseErrors.push({
        index: i,
        field: !isNaN(lat) ? 'longitude' : 'latitude',
        message: `Invalid coordinates at row ${i + 1}: latitude="${row['latitude']}", longitude="${row['longitude']}"`,
      });
      continue;
    }

    const open_hours: Record<string, { open: string; close: string }> = {};
    for (const [csvCol, dayKey] of Object.entries(DAY_MAP)) {
      const parsed = parseHoursString(row[csvCol]);
      if (parsed) {
        open_hours[dayKey] = parsed;
      } else if (row[csvCol]?.trim() && row[csvCol].trim().toLowerCase() !== 'closed') {
        parseErrors.push({
          index: i,
          field: csvCol,
          message: `Invalid hours format at row ${i + 1}, column "${csvCol}": expected "HH:MM-HH:MM" or "closed", got "${row[csvCol]}"`,
        });
      }
    }

    const cuisineRaw = row['cuisine_types']?.trim() ?? '';
    const cuisine_types = cuisineRaw
      ? cuisineRaw
          .split(';')
          .map(c => c.trim())
          .filter(Boolean)
      : [];

    const restaurant: MappedRestaurant = {
      name,
      address: row['address']?.trim() ?? '',
      latitude: lat,
      longitude: lng,
      phone: row['phone']?.trim() || undefined,
      website: row['website']?.trim() || undefined,
      restaurant_type: row['restaurant_type']?.trim() || 'restaurant',
      cuisine_types,
      country_code: row['country_code']?.trim() || 'MX',
      city: row['city']?.trim() || undefined,
      state: row['state']?.trim() || undefined,
      postal_code: row['postal_code']?.trim() || undefined,
      open_hours: Object.keys(open_hours).length > 0 ? open_hours : undefined,
    };

    restaurants.push(restaurant);
  }

  return { restaurants, parseErrors };
}

/** Return CSV template header + one example row.
 * @returns*/
export function generateCsvTemplate(): string {
  const header =
    'name,address,latitude,longitude,phone,website,restaurant_type,cuisine_types,country_code,city,state,postal_code,mon_hours,tue_hours,wed_hours,thu_hours,fri_hours,sat_hours,sun_hours';
  const example =
    'Taquería El Paisa,Av Insurgentes Sur 1234 CDMX,19.3910,-99.1670,+525512345678,https://example.com,restaurant,Mexican,MX,Mexico City,CDMX,06600,08:00-22:00,08:00-22:00,08:00-22:00,08:00-22:00,08:00-23:00,09:00-23:00,09:00-20:00';
  return `${header}\n${example}\n`;
}
