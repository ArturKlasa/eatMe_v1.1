export const PRIMARY_PROTEINS = [
  'chicken',
  'turkey',
  'beef',
  'pork',
  'lamb',
  'goat',
  'other_meat',
  'fish',
  'shellfish',
  'eggs',
  'vegetarian',
  'vegan',
] as const;

export type PrimaryProtein = (typeof PRIMARY_PROTEINS)[number];

export interface DerivedProteinFields {
  protein_families: string[];
  protein_canonical_names: string[];
}

export function deriveProteinFields(p: PrimaryProtein | null | undefined): DerivedProteinFields {
  if (!p) {
    return { protein_families: [], protein_canonical_names: [] };
  }

  switch (p) {
    case 'chicken':
    case 'turkey':
      return {
        protein_families: ['meat', 'poultry'],
        protein_canonical_names: [p],
      };
    case 'beef':
    case 'pork':
    case 'lamb':
    case 'goat':
    case 'other_meat':
      return {
        protein_families: ['meat'],
        protein_canonical_names: [p],
      };
    case 'fish':
      return {
        protein_families: ['fish'],
        protein_canonical_names: [p],
      };
    case 'shellfish':
      return {
        protein_families: ['shellfish'],
        protein_canonical_names: [p],
      };
    case 'eggs':
      return {
        protein_families: ['eggs'],
        protein_canonical_names: [p],
      };
    case 'vegetarian':
      return {
        protein_families: [],
        protein_canonical_names: [],
      };
    case 'vegan':
      return {
        protein_families: [],
        protein_canonical_names: [],
      };
  }
}
