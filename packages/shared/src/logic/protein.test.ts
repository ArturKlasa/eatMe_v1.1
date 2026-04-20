import { describe, it, expect } from 'vitest';
import { deriveProteinFields, PRIMARY_PROTEINS } from './protein';

describe('deriveProteinFields', () => {
  it('returns empty arrays for null', () => {
    const result = deriveProteinFields(null);
    expect(result).toEqual({
      protein_families: [],
      protein_canonical_names: [],
      dietary_tags_override: null,
    });
  });

  it('returns empty arrays for undefined', () => {
    const result = deriveProteinFields(undefined);
    expect(result).toEqual({
      protein_families: [],
      protein_canonical_names: [],
      dietary_tags_override: null,
    });
  });

  it('chicken → meat + poultry families', () => {
    const result = deriveProteinFields('chicken');
    expect(result.protein_families).toEqual(['meat', 'poultry']);
    expect(result.protein_canonical_names).toEqual(['chicken']);
    expect(result.dietary_tags_override).toBeNull();
  });

  it('duck → meat + poultry families', () => {
    const result = deriveProteinFields('duck');
    expect(result.protein_families).toEqual(['meat', 'poultry']);
    expect(result.protein_canonical_names).toEqual(['duck']);
    expect(result.dietary_tags_override).toBeNull();
  });

  it('beef → meat family', () => {
    const result = deriveProteinFields('beef');
    expect(result.protein_families).toEqual(['meat']);
    expect(result.protein_canonical_names).toEqual(['beef']);
    expect(result.dietary_tags_override).toBeNull();
  });

  it('pork → meat family', () => {
    const result = deriveProteinFields('pork');
    expect(result.protein_families).toEqual(['meat']);
    expect(result.protein_canonical_names).toEqual(['pork']);
    expect(result.dietary_tags_override).toBeNull();
  });

  it('lamb → meat family', () => {
    const result = deriveProteinFields('lamb');
    expect(result.protein_families).toEqual(['meat']);
    expect(result.protein_canonical_names).toEqual(['lamb']);
    expect(result.dietary_tags_override).toBeNull();
  });

  it('other_meat → meat family', () => {
    const result = deriveProteinFields('other_meat');
    expect(result.protein_families).toEqual(['meat']);
    expect(result.protein_canonical_names).toEqual(['other_meat']);
    expect(result.dietary_tags_override).toBeNull();
  });

  it('fish → fish family', () => {
    const result = deriveProteinFields('fish');
    expect(result.protein_families).toEqual(['fish']);
    expect(result.protein_canonical_names).toEqual(['fish']);
    expect(result.dietary_tags_override).toBeNull();
  });

  it('shellfish → shellfish family', () => {
    const result = deriveProteinFields('shellfish');
    expect(result.protein_families).toEqual(['shellfish']);
    expect(result.protein_canonical_names).toEqual(['shellfish']);
    expect(result.dietary_tags_override).toBeNull();
  });

  it('eggs → eggs family', () => {
    const result = deriveProteinFields('eggs');
    expect(result.protein_families).toEqual(['eggs']);
    expect(result.protein_canonical_names).toEqual(['eggs']);
    expect(result.dietary_tags_override).toBeNull();
  });

  it('vegetarian → empty families, dietary override vegetarian', () => {
    const result = deriveProteinFields('vegetarian');
    expect(result.protein_families).toEqual([]);
    expect(result.protein_canonical_names).toEqual([]);
    expect(result.dietary_tags_override).toEqual(['vegetarian']);
  });

  it('vegan → empty families, dietary override vegan + vegetarian', () => {
    const result = deriveProteinFields('vegan');
    expect(result.protein_families).toEqual([]);
    expect(result.protein_canonical_names).toEqual([]);
    expect(result.dietary_tags_override).toEqual(['vegan', 'vegetarian']);
  });

  it('PRIMARY_PROTEINS covers all 11 values', () => {
    expect(PRIMARY_PROTEINS).toHaveLength(11);
  });
});
