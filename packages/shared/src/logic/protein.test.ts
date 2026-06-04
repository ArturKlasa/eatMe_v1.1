import { describe, it, expect } from 'vitest';
import { deriveProteinFields, PRIMARY_PROTEINS } from './protein';

describe('deriveProteinFields', () => {
  it('returns empty arrays for null', () => {
    const result = deriveProteinFields(null);
    expect(result).toEqual({
      protein_families: [],
      protein_canonical_names: [],
    });
  });

  it('returns empty arrays for undefined', () => {
    const result = deriveProteinFields(undefined);
    expect(result).toEqual({
      protein_families: [],
      protein_canonical_names: [],
    });
  });

  it('chicken → meat + poultry families', () => {
    const result = deriveProteinFields('chicken');
    expect(result.protein_families).toEqual(['meat', 'poultry']);
    expect(result.protein_canonical_names).toEqual(['chicken']);
  });

  it('goat → meat family', () => {
    const result = deriveProteinFields('goat');
    expect(result.protein_families).toEqual(['meat']);
    expect(result.protein_canonical_names).toEqual(['goat']);
  });

  it('beef → meat family', () => {
    const result = deriveProteinFields('beef');
    expect(result.protein_families).toEqual(['meat']);
    expect(result.protein_canonical_names).toEqual(['beef']);
  });

  it('pork → meat family', () => {
    const result = deriveProteinFields('pork');
    expect(result.protein_families).toEqual(['meat']);
    expect(result.protein_canonical_names).toEqual(['pork']);
  });

  it('lamb → meat family', () => {
    const result = deriveProteinFields('lamb');
    expect(result.protein_families).toEqual(['meat']);
    expect(result.protein_canonical_names).toEqual(['lamb']);
  });

  it('other_meat → meat family', () => {
    const result = deriveProteinFields('other_meat');
    expect(result.protein_families).toEqual(['meat']);
    expect(result.protein_canonical_names).toEqual(['other_meat']);
  });

  it('fish → fish family', () => {
    const result = deriveProteinFields('fish');
    expect(result.protein_families).toEqual(['fish']);
    expect(result.protein_canonical_names).toEqual(['fish']);
  });

  it('shellfish → shellfish family', () => {
    const result = deriveProteinFields('shellfish');
    expect(result.protein_families).toEqual(['shellfish']);
    expect(result.protein_canonical_names).toEqual(['shellfish']);
  });

  it('eggs → eggs family', () => {
    const result = deriveProteinFields('eggs');
    expect(result.protein_families).toEqual(['eggs']);
    expect(result.protein_canonical_names).toEqual(['eggs']);
  });

  it('vegetarian → empty families', () => {
    const result = deriveProteinFields('vegetarian');
    expect(result.protein_families).toEqual([]);
    expect(result.protein_canonical_names).toEqual([]);
  });

  it('vegan → empty families', () => {
    const result = deriveProteinFields('vegan');
    expect(result.protein_families).toEqual([]);
    expect(result.protein_canonical_names).toEqual([]);
  });

  it('PRIMARY_PROTEINS covers all 11 values', () => {
    expect(PRIMARY_PROTEINS).toHaveLength(11);
  });
});
