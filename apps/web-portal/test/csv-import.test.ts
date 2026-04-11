import { describe, it, expect } from 'vitest';
import { parseCsvToRestaurants, generateCsvTemplate } from '@/lib/csv-import';

// ─── generateCsvTemplate ──────────────────────────────────────────────────────

describe('generateCsvTemplate', () => {
  it('returns a non-empty string with the required header columns', () => {
    const csv = generateCsvTemplate();
    expect(typeof csv).toBe('string');
    expect(csv.length).toBeGreaterThan(0);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('name');
    expect(firstLine).toContain('latitude');
    expect(firstLine).toContain('longitude');
    expect(firstLine).toContain('cuisine_types');
    expect(firstLine).toContain('mon_hours');
    expect(firstLine).toContain('sun_hours');
  });

  it('includes an example data row', () => {
    const csv = generateCsvTemplate();
    const lines = csv.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    // Example row should have valid coords
    expect(lines[1]).toContain('19.3910');
  });
});

// ─── parseCsvToRestaurants ────────────────────────────────────────────────────

const FULL_CSV = `name,address,latitude,longitude,phone,website,restaurant_type,cuisine_types,country_code,city,state,postal_code,mon_hours,tue_hours,wed_hours,thu_hours,fri_hours,sat_hours,sun_hours
Taquería El Paisa,Av Insurgentes Sur 1234 CDMX,19.3910,-99.1670,+525512345678,https://example.com,restaurant,Mexican,MX,Mexico City,CDMX,06600,08:00-22:00,08:00-22:00,08:00-22:00,08:00-22:00,08:00-23:00,09:00-23:00,09:00-20:00
`;

describe('parseCsvToRestaurants', () => {
  it('parses a complete valid CSV row', () => {
    const { restaurants, parseErrors } = parseCsvToRestaurants(FULL_CSV);
    expect(parseErrors).toHaveLength(0);
    expect(restaurants).toHaveLength(1);
    const r = restaurants[0];
    expect(r.name).toBe('Taquería El Paisa');
    expect(r.latitude).toBe(19.391);
    expect(r.longitude).toBe(-99.167);
    expect(r.phone).toBe('+525512345678');
    expect(r.cuisine_types).toEqual(['Mexican']);
    expect(r.country_code).toBe('MX');
    expect(r.city).toBe('Mexico City');
  });

  it('parses open_hours correctly from day columns', () => {
    const { restaurants } = parseCsvToRestaurants(FULL_CSV);
    const r = restaurants[0];
    expect(r.open_hours?.monday).toEqual({ open: '08:00', close: '22:00' });
    expect(r.open_hours?.friday).toEqual({ open: '08:00', close: '23:00' });
    expect(r.open_hours?.sunday).toEqual({ open: '09:00', close: '20:00' });
  });

  it('parses minimal CSV with only required columns', () => {
    const csv = `name,latitude,longitude\nEl Taco,19.39,-99.16\n`;
    const { restaurants, parseErrors } = parseCsvToRestaurants(csv);
    expect(parseErrors).toHaveLength(0);
    expect(restaurants).toHaveLength(1);
    expect(restaurants[0].name).toBe('El Taco');
    expect(restaurants[0].cuisine_types).toEqual([]);
    expect(restaurants[0].restaurant_type).toBe('restaurant');
    expect(restaurants[0].country_code).toBe('MX');
  });

  it('returns error for missing required column "name"', () => {
    const csv = `address,latitude,longitude\nSome Address,19.39,-99.16\n`;
    const { restaurants, parseErrors } = parseCsvToRestaurants(csv);
    expect(parseErrors.length).toBeGreaterThan(0);
    expect(parseErrors.some((e) => e.message.includes('"name"'))).toBe(true);
    expect(restaurants).toHaveLength(0);
  });

  it('returns error for missing required column "latitude"', () => {
    const csv = `name,longitude\nEl Taco,-99.16\n`;
    const { restaurants, parseErrors } = parseCsvToRestaurants(csv);
    expect(parseErrors.some((e) => e.message.includes('"latitude"'))).toBe(true);
    expect(restaurants).toHaveLength(0);
  });

  it('returns row-level error when name is empty in a row', () => {
    const csv = `name,latitude,longitude\n,19.39,-99.16\n`;
    const { restaurants, parseErrors } = parseCsvToRestaurants(csv);
    expect(parseErrors.length).toBeGreaterThan(0);
    expect(restaurants).toHaveLength(0);
  });

  it('returns row-level error for invalid latitude', () => {
    const csv = `name,latitude,longitude\nEl Taco,not-a-number,-99.16\n`;
    const { restaurants, parseErrors } = parseCsvToRestaurants(csv);
    expect(parseErrors.length).toBeGreaterThan(0);
    expect(restaurants).toHaveLength(0);
  });

  it('parses semicolon-separated cuisine_types', () => {
    const csv = `name,latitude,longitude,cuisine_types\nEl Taco,19.39,-99.16,Mexican;Tacos;Street Food\n`;
    const { restaurants } = parseCsvToRestaurants(csv);
    expect(restaurants[0].cuisine_types).toEqual(['Mexican', 'Tacos', 'Street Food']);
  });

  it('handles "closed" in day hours by omitting that day', () => {
    const csv = `name,latitude,longitude,mon_hours,sun_hours\nEl Taco,19.39,-99.16,closed,closed\n`;
    const { restaurants } = parseCsvToRestaurants(csv);
    expect(restaurants[0].open_hours?.monday).toBeUndefined();
    expect(restaurants[0].open_hours?.sunday).toBeUndefined();
  });

  it('handles empty hours cells by omitting that day', () => {
    const csv = `name,latitude,longitude,mon_hours\nEl Taco,19.39,-99.16,\n`;
    const { restaurants } = parseCsvToRestaurants(csv);
    expect(restaurants[0].open_hours?.monday).toBeUndefined();
  });

  it('returns error for invalid hours format', () => {
    const csv = `name,latitude,longitude,mon_hours\nEl Taco,19.39,-99.16,9am-10pm\n`;
    const { restaurants, parseErrors } = parseCsvToRestaurants(csv);
    // Row is still parsed (other fields valid), but a parse error is reported
    expect(parseErrors.some((e) => e.field === 'mon_hours')).toBe(true);
    // The restaurant itself is still included (row was not fully invalid)
    expect(restaurants).toHaveLength(1);
  });

  it('handles UTF-8 BOM without error', () => {
    const csv = '\uFEFFname,latitude,longitude\nEl Taco,19.39,-99.16\n';
    const { restaurants, parseErrors } = parseCsvToRestaurants(csv);
    expect(parseErrors).toHaveLength(0);
    expect(restaurants).toHaveLength(1);
    expect(restaurants[0].name).toBe('El Taco');
  });

  it('handles special characters (accents, ñ) in names', () => {
    const csv = `name,latitude,longitude\nTaquería Señor Jalapeño,19.39,-99.16\n`;
    const { restaurants, parseErrors } = parseCsvToRestaurants(csv);
    expect(parseErrors).toHaveLength(0);
    expect(restaurants[0].name).toBe('Taquería Señor Jalapeño');
  });

  it('skips empty rows silently', () => {
    const csv = `name,latitude,longitude\nEl Taco,19.39,-99.16\n\n\n`;
    const { restaurants, parseErrors } = parseCsvToRestaurants(csv);
    expect(parseErrors).toHaveLength(0);
    expect(restaurants).toHaveLength(1);
  });

  it('sets open_hours to undefined when no day columns present', () => {
    const csv = `name,latitude,longitude\nEl Taco,19.39,-99.16\n`;
    const { restaurants } = parseCsvToRestaurants(csv);
    expect(restaurants[0].open_hours).toBeUndefined();
  });
});
