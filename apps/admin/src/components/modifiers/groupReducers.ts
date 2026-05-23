import {
  newEmptyModifierGroup,
  newEmptyModifierOption,
  type EditableModifierGroup,
  type EditableModifierOption,
} from './editableTypes';

// Pure list reducers operating on a single dish's modifier_groups.
// Callers compose these into setState updaters; e.g.
//   setDishes(prev => prev.map(d => d.id === dishId
//     ? { ...d, modifier_groups: addGroup(d.modifier_groups) }
//     : d))

// ── Group helpers ────────────────────────────────────────────────────────────

export function addGroup(groups: EditableModifierGroup[]): EditableModifierGroup[] {
  return [...groups, newEmptyModifierGroup()];
}

export function removeGroup(groups: EditableModifierGroup[], idx: number): EditableModifierGroup[] {
  return groups.filter((_, i) => i !== idx);
}

export function moveGroup(
  groups: EditableModifierGroup[],
  from: number,
  to: number
): EditableModifierGroup[] {
  if (from === to || from < 0 || to < 0 || from >= groups.length || to >= groups.length) {
    return groups;
  }
  const next = [...groups];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function updateGroup(
  groups: EditableModifierGroup[],
  idx: number,
  patch: Partial<EditableModifierGroup>
): EditableModifierGroup[] {
  return groups.map((g, i) => (i === idx ? { ...g, ...patch } : g));
}

// ── Option helpers ───────────────────────────────────────────────────────────

export function addOption(
  groups: EditableModifierGroup[],
  groupIdx: number
): EditableModifierGroup[] {
  return groups.map((g, i) => {
    if (i !== groupIdx) return g;
    return { ...g, options: [...g.options, newEmptyModifierOption()] };
  });
}

export function removeOption(
  groups: EditableModifierGroup[],
  groupIdx: number,
  optIdx: number
): EditableModifierGroup[] {
  return groups.map((g, i) => {
    if (i !== groupIdx) return g;
    return { ...g, options: g.options.filter((_, ii) => ii !== optIdx) };
  });
}

export function moveOption(
  groups: EditableModifierGroup[],
  groupIdx: number,
  from: number,
  to: number
): EditableModifierGroup[] {
  return groups.map((g, i) => {
    if (i !== groupIdx) return g;
    if (from === to || from < 0 || to < 0 || from >= g.options.length || to >= g.options.length) {
      return g;
    }
    const opts = [...g.options];
    const [moved] = opts.splice(from, 1);
    opts.splice(to, 0, moved);
    return { ...g, options: opts };
  });
}

export function updateOption(
  groups: EditableModifierGroup[],
  groupIdx: number,
  optIdx: number,
  patch: Partial<EditableModifierOption>
): EditableModifierGroup[] {
  return groups.map((g, i) => {
    if (i !== groupIdx) return g;
    return {
      ...g,
      options: g.options.map((o, ii) => (ii === optIdx ? { ...o, ...patch } : o)),
    };
  });
}
