import type { z } from 'zod';
import type { AdminMenuModifierGroup, AdminMenuModifierOption } from '@/lib/auth/dal';
import type { EditableModifierGroup, EditableModifierOption, Protein } from './editableTypes';
import type { modifierGroupSchema } from '@/lib/modifiers/schemas';

// Inferred from the Zod schema (single source of truth — no hand-maintained
// duplicate interface). z.infer<> returns the OUTPUT type (post-parse, with
// defaults applied), which is exactly what callers send to the server action.
export type ApiGroupPayload = z.infer<typeof modifierGroupSchema>;

// ── DAL → Editable (open-edit path) ──────────────────────────────────────────

function toEditableOption(o: AdminMenuModifierOption): EditableModifierOption {
  return {
    _id: o.id,
    name: o.name,
    price_delta: o.price_delta,
    price_override: o.price_override,
    // DAL types primary_protein as `string | null` (loose typing on the read
    // path). The DB column is constrained to PRIMARY_PROTEINS or null, so the
    // narrowing cast is safe.
    primary_protein: o.primary_protein as Protein | null,
    serves_delta: o.serves_delta,
    is_default: o.is_default,
  };
}

export function toEditableGroup(g: AdminMenuModifierGroup): EditableModifierGroup {
  return {
    _id: g.id,
    name: g.name,
    selection_type: g.selection_type,
    min_selections: g.min_selections,
    max_selections: g.max_selections,
    display_in_card: g.display_in_card,
    options: g.options.map(toEditableOption),
  };
}

export function toEditableGroups(gs: AdminMenuModifierGroup[]): EditableModifierGroup[] {
  return gs.map(toEditableGroup);
}

// ── Editable → API payload (Save path; strips _id, matches Zod schema) ──────

function toApiOption(o: EditableModifierOption): ApiGroupPayload['options'][number] {
  return {
    name: o.name,
    price_delta: o.price_delta,
    price_override: o.price_override,
    primary_protein: o.primary_protein,
    serves_delta: o.serves_delta,
    is_default: o.is_default,
  };
}

export function toApiGroup(g: EditableModifierGroup): ApiGroupPayload {
  return {
    name: g.name,
    selection_type: g.selection_type,
    min_selections: g.min_selections,
    max_selections: g.max_selections,
    display_in_card: g.display_in_card,
    options: g.options.map(toApiOption),
  };
}

export function toApiGroups(gs: EditableModifierGroup[]): ApiGroupPayload[] {
  return gs.map(toApiGroup);
}

// ── Deep equality for the §2.2 dirty check ──────────────────────────────────

// Canonical form drops both `_id` (Editable) and `id` (DAL) and normalises
// optional/nullable fields. Both Editable* and AdminMenuModifier* are
// structurally compatible with the shape this function reads.
type AnyGroup = EditableModifierGroup | AdminMenuModifierGroup;

function canonicalize(groups: readonly AnyGroup[]): string {
  const normalised = groups.map(g => ({
    name: g.name,
    selection_type: g.selection_type,
    min_selections: g.min_selections,
    max_selections: g.max_selections,
    display_in_card: g.display_in_card,
    options: g.options.map(o => ({
      name: o.name,
      price_delta: o.price_delta,
      price_override: o.price_override ?? null,
      primary_protein: o.primary_protein ?? null,
      serves_delta: o.serves_delta,
      is_default: o.is_default,
    })),
  }));
  return JSON.stringify(normalised);
}

export function groupsEqual(a: EditableModifierGroup[], b: AdminMenuModifierGroup[]): boolean {
  return canonicalize(a) === canonicalize(b);
}
