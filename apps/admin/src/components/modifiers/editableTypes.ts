import { PRIMARY_PROTEINS } from '@eatme/shared';

export type Protein = (typeof PRIMARY_PROTEINS)[number];

// Wire-format option from menu-scan-worker.
export type ExtractedModifierOption = {
  name: string;
  price_delta: number;
  price_override: number | null;
  primary_protein: Protein | null;
  removes_dietary_tags: string[];
  adds_allergens: string[];
  serves_delta: number;
  is_default: boolean;
};

// Wire-format group from menu-scan-worker.
export type ExtractedModifierGroup = {
  name: string;
  selection_type: 'single' | 'multiple';
  min_selections: number;
  max_selections: number;
  display_in_card: boolean;
  options: ExtractedModifierOption[];
};

// In-editor versions carry a local _id (for stable React keys + reordering).
// Otherwise they match the wire shape one-to-one.

export type EditableModifierOption = ExtractedModifierOption & {
  _id: string;
};

export type EditableModifierGroup = Omit<ExtractedModifierGroup, 'options'> & {
  _id: string;
  options: EditableModifierOption[];
};

// ── Factories ────────────────────────────────────────────────────────────────

export function newEmptyModifierGroup(): EditableModifierGroup {
  return {
    _id: `mg-${crypto.randomUUID()}`,
    name: '',
    selection_type: 'single',
    min_selections: 1,
    max_selections: 1,
    display_in_card: false,
    options: [],
  };
}

export function newEmptyModifierOption(): EditableModifierOption {
  return {
    _id: `mo-${crypto.randomUUID()}`,
    name: '',
    price_delta: 0,
    price_override: null,
    primary_protein: null,
    removes_dietary_tags: [],
    adds_allergens: [],
    serves_delta: 0,
    is_default: false,
  };
}
