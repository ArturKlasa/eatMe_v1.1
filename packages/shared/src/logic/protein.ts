export const PRIMARY_PROTEINS = [
  'chicken',
  'beef',
  'pork',
  'lamb',
  'duck',
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
  /** null = no override; let trigger derive from dish_ingredients */
  dietary_tags_override: string[] | null;
}

export function deriveProteinFields(p: PrimaryProtein | null | undefined): DerivedProteinFields {
  if (!p) {
    return { protein_families: [], protein_canonical_names: [], dietary_tags_override: null };
  }

  switch (p) {
    case 'chicken':
    case 'duck':
      return {
        protein_families: ['meat', 'poultry'],
        protein_canonical_names: [p],
        dietary_tags_override: null,
      };
    case 'beef':
    case 'pork':
    case 'lamb':
    case 'other_meat':
      return {
        protein_families: ['meat'],
        protein_canonical_names: [p],
        dietary_tags_override: null,
      };
    case 'fish':
      return {
        protein_families: ['fish'],
        protein_canonical_names: [p],
        dietary_tags_override: null,
      };
    case 'shellfish':
      return {
        protein_families: ['shellfish'],
        protein_canonical_names: [p],
        dietary_tags_override: null,
      };
    case 'eggs':
      return {
        protein_families: ['eggs'],
        protein_canonical_names: [p],
        dietary_tags_override: null,
      };
    case 'vegetarian':
      return {
        protein_families: [],
        protein_canonical_names: [],
        dietary_tags_override: ['vegetarian'],
      };
    case 'vegan':
      return {
        protein_families: [],
        protein_canonical_names: [],
        dietary_tags_override: ['vegan', 'vegetarian'],
      };
  }
}
