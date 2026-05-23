import { describe, it, expect } from 'vitest';
import {
  toEditableGroup,
  toEditableGroups,
  toApiGroup,
  toApiGroups,
  groupsEqual,
} from '@/components/modifiers/adapters';
import { modifierGroupSchema } from '@/lib/modifiers/schemas';
import type { AdminMenuModifierGroup } from '@/lib/auth/dal';

function makeDalGroup(overrides: Partial<AdminMenuModifierGroup> = {}): AdminMenuModifierGroup {
  return {
    id: 'g-uuid-1',
    name: 'Size',
    selection_type: 'single',
    min_selections: 1,
    max_selections: 1,
    display_in_card: true,
    options: [
      {
        id: 'o-uuid-1',
        name: 'Small',
        price_delta: 0,
        price_override: null,
        primary_protein: 'chicken',
        removes_dietary_tags: ['vegetarian'],
        adds_allergens: ['gluten'],
        serves_delta: -1,
        is_default: true,
      },
      {
        id: 'o-uuid-2',
        name: 'Large',
        price_delta: 3.5,
        price_override: null,
        primary_protein: null,
        removes_dietary_tags: [],
        adds_allergens: [],
        serves_delta: 1,
        is_default: false,
      },
    ],
    ...overrides,
  };
}

describe('toEditableGroup / toApiGroup round-trip', () => {
  it('preserves every field except id/_id through DAL → Editable → API', () => {
    const dal = makeDalGroup();
    const api = toApiGroup(toEditableGroup(dal));

    // API shape matches the DAL shape with `id` removed and option `id` removed.
    expect(api).toEqual({
      name: dal.name,
      selection_type: dal.selection_type,
      min_selections: dal.min_selections,
      max_selections: dal.max_selections,
      display_in_card: dal.display_in_card,
      options: dal.options.map(o => ({
        name: o.name,
        price_delta: o.price_delta,
        price_override: o.price_override,
        primary_protein: o.primary_protein,
        removes_dietary_tags: o.removes_dietary_tags,
        adds_allergens: o.adds_allergens,
        serves_delta: o.serves_delta,
        is_default: o.is_default,
      })),
    });
    // Sanity: no id leaked into the API payload.
    expect(api).not.toHaveProperty('id');
    expect(api).not.toHaveProperty('_id');
    for (const o of api.options) {
      expect(o).not.toHaveProperty('id');
      expect(o).not.toHaveProperty('_id');
    }
  });

  it('round-trips a group with empty options array', () => {
    const dal = makeDalGroup({ options: [] });
    const api = toApiGroup(toEditableGroup(dal));
    expect(api.options).toEqual([]);
  });
});

describe('Zod conformance', () => {
  it('toApiGroup output parses cleanly against modifierGroupSchema', () => {
    const dal = makeDalGroup();
    const api = toApiGroup(toEditableGroup(dal));
    const parsed = modifierGroupSchema.safeParse(api);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      // Surface the actual Zod error if something is off.
      throw new Error(`Zod rejected adapter output: ${parsed.error.message}`);
    }
  });

  it('toApiGroups output parses cleanly when wrapped in z.array', () => {
    const dal = [
      makeDalGroup({ id: 'g-1', name: 'Size' }),
      makeDalGroup({ id: 'g-2', name: 'Toppings' }),
    ];
    const apis = toApiGroups(toEditableGroups(dal));
    for (const api of apis) {
      const parsed = modifierGroupSchema.safeParse(api);
      expect(parsed.success).toBe(true);
    }
  });
});

describe('groupsEqual', () => {
  it('returns true when editable groups were freshly derived from the DAL groups', () => {
    const dal = [makeDalGroup({ id: 'g-1' }), makeDalGroup({ id: 'g-2', name: 'Toppings' })];
    const editable = toEditableGroups(dal);
    expect(groupsEqual(editable, dal)).toBe(true);
  });

  it('returns false when a group name changed', () => {
    const dal = [makeDalGroup()];
    const editable = toEditableGroups(dal);
    editable[0].name = 'Renamed';
    expect(groupsEqual(editable, dal)).toBe(false);
  });

  it('returns false when an option was added', () => {
    const dal = [makeDalGroup()];
    const editable = toEditableGroups(dal);
    editable[0].options.push({
      _id: 'new',
      name: 'XL',
      price_delta: 5,
      price_override: null,
      primary_protein: null,
      removes_dietary_tags: [],
      adds_allergens: [],
      serves_delta: 2,
      is_default: false,
    });
    expect(groupsEqual(editable, dal)).toBe(false);
  });

  it('returns false when options were reordered', () => {
    const dal = [makeDalGroup()];
    const editable = toEditableGroups(dal);
    editable[0].options.reverse();
    expect(groupsEqual(editable, dal)).toBe(false);
  });

  it('returns false when an option price_delta changed', () => {
    const dal = [makeDalGroup()];
    const editable = toEditableGroups(dal);
    editable[0].options[1].price_delta = 999;
    expect(groupsEqual(editable, dal)).toBe(false);
  });

  it('returns true when ids differ but all other fields are identical', () => {
    // Simulates the post-save state: same content, server-assigned new ids.
    const dal1 = [makeDalGroup({ id: 'g-uuid-old' })];
    const dal2 = [makeDalGroup({ id: 'g-uuid-new' })];
    const editable = toEditableGroups(dal1);
    expect(groupsEqual(editable, dal2)).toBe(true);
  });
});
