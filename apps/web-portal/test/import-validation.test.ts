import { describe, it, expect } from 'vitest';
import { validateImportedRestaurant } from '@/lib/import-validation';
import type { MappedRestaurant } from '@/lib/import-types';

const validRestaurant: MappedRestaurant = {
  name: 'Taquería El Paisa',
  address: 'Av Insurgentes Sur 1234, CDMX',
  latitude: 19.391,
  longitude: -99.167,
  restaurant_type: 'restaurant',
  cuisine_types: ['Mexican'],
  country_code: 'MX',
};

describe('validateImportedRestaurant', () => {
  it('passes valid restaurant data', () => {
    const result = validateImportedRestaurant(validRestaurant);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitized.name).toBe('Taquería El Paisa');
  });

  it('fails when name is missing', () => {
    const r = { ...validRestaurant, name: '' };
    const result = validateImportedRestaurant(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('fails when latitude is out of range (91)', () => {
    const r = { ...validRestaurant, latitude: 91 };
    const result = validateImportedRestaurant(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'latitude')).toBe(true);
  });

  it('fails when longitude is out of range (-181)', () => {
    const r = { ...validRestaurant, longitude: -181 };
    const result = validateImportedRestaurant(r);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'longitude')).toBe(true);
  });

  it('falls back to "restaurant" for unknown restaurant_type', () => {
    const r = { ...validRestaurant, restaurant_type: 'submarine_sandwich_shop' };
    const result = validateImportedRestaurant(r);
    expect(result.valid).toBe(true);
    expect(result.sanitized.restaurant_type).toBe('restaurant');
  });

  it('falls back to "MX" for unknown country_code', () => {
    const r = { ...validRestaurant, country_code: 'ZZ' };
    const result = validateImportedRestaurant(r);
    expect(result.valid).toBe(true);
    expect(result.sanitized.country_code).toBe('MX');
  });

  it('passes with empty cuisine_types (will be flagged as warning but not invalid)', () => {
    const r = { ...validRestaurant, cuisine_types: [] };
    const result = validateImportedRestaurant(r);
    expect(result.valid).toBe(true);
    expect(result.sanitized.cuisine_types).toHaveLength(0);
  });

  it('filters out unknown cuisine types from the list', () => {
    const r = { ...validRestaurant, cuisine_types: ['Mexican', 'UnknownCuisineXYZ'] };
    const result = validateImportedRestaurant(r);
    expect(result.valid).toBe(true);
    expect(result.sanitized.cuisine_types).toEqual(['Mexican']);
  });

  it('trims whitespace from name', () => {
    const r = { ...validRestaurant, name: '  El Paisa  ' };
    const result = validateImportedRestaurant(r);
    expect(result.valid).toBe(true);
    expect(result.sanitized.name).toBe('El Paisa');
  });
});
