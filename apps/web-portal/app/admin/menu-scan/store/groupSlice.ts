import { StateCreator } from 'zustand';
import { toast } from 'sonner';
import type { EditableDish, EditableMenu, FlaggedDuplicate } from '@/lib/menu-scan';
import type { BatchFilters } from '@/components/admin/menu-scan/BatchToolbar';

export interface GroupSlice {
  flaggedDuplicates: FlaggedDuplicate[];
  selectedGroupIds: Set<string>;
  batchFilters: BatchFilters;
  focusedGroupId: string | null;

  setFlaggedDuplicates: (dups: FlaggedDuplicate[]) => void;
  setSelectedGroupIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setBatchFilters: (filters: BatchFilters) => void;
  setFocusedGroupId: (id: string | null) => void;

  acceptGroup: (parentId: string) => void;
  rejectGroup: (parentId: string) => void;
  ungroupChild: (childId: string) => void;
  groupFlaggedDuplicate: (dupIndex: number) => void;
  dismissFlaggedDuplicate: (dupIndex: number) => void;
  acceptHighConfidence: (threshold: number) => void;
  acceptSelected: () => void;
  rejectSelected: () => void;
}

const initialState = {
  flaggedDuplicates: [] as FlaggedDuplicate[],
  selectedGroupIds: new Set<string>(),
  batchFilters: { confidenceMin: null, dishKind: null, hasGrouping: null } as BatchFilters,
  focusedGroupId: null as string | null,
};

function applyGroupStatus(
  menus: EditableMenu[],
  predicate: (d: EditableDish) => boolean,
  status: EditableDish['group_status']
): EditableMenu[] {
  return menus.map(m => ({
    ...m,
    categories: m.categories.map(c => ({
      ...c,
      dishes: c.dishes.map(d => (predicate(d) ? { ...d, group_status: status } : d)),
    })),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createGroupSlice: StateCreator<any, [], [], GroupSlice> = (set, get) => ({
  ...initialState,

  setFlaggedDuplicates: dups => set({ flaggedDuplicates: dups }),

  setSelectedGroupIds: v =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set((s: any) => ({
      selectedGroupIds: typeof v === 'function' ? v(s.selectedGroupIds) : v,
    })),

  setBatchFilters: filters => set({ batchFilters: filters }),

  setFocusedGroupId: id => set({ focusedGroupId: id }),

  acceptGroup: (parentId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set((s: any) => ({
      editableMenus: applyGroupStatus(
        s.editableMenus,
        d => d._id === parentId || d.parent_id === parentId,
        'accepted'
      ),
    }));
    toast.success('Group accepted');
  },

  rejectGroup: (parentId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set((s: any) => ({
      editableMenus: applyGroupStatus(
        s.editableMenus,
        d => d._id === parentId || d.parent_id === parentId,
        'rejected'
      ),
    }));
    toast('Group rejected', { icon: '✕' });
  },

  ungroupChild: (childId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set((s: any) => ({
      editableMenus: (s.editableMenus as EditableMenu[]).map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d._id === childId) {
              return { ...d, parent_id: null, is_parent: false, group_status: 'manual' as const };
            }
            if (d.variant_ids.includes(childId)) {
              const newVariantIds = d.variant_ids.filter((id: string) => id !== childId);
              return { ...d, variant_ids: newVariantIds, is_parent: newVariantIds.length > 0 };
            }
            return d;
          }),
        })),
      })),
    }));
    toast('Variant ungrouped');
  },

  groupFlaggedDuplicate: (dupIndex: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dup = (get() as any).flaggedDuplicates[dupIndex] as FlaggedDuplicate | undefined;
    if (!dup) return;

    const targetName = dup.existingDish.name.toLowerCase().trim();
    const targetPrice = String(dup.existingDish.price);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set((s: any) => ({
      editableMenus: (s.editableMenus as EditableMenu[]).map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d.name.toLowerCase().trim() === targetName && d.price === targetPrice) {
              return {
                ...d,
                is_parent: true,
                dish_kind: 'standard' as const,
                display_price_prefix: 'from' as const,
                group_status: 'manual' as const,
              };
            }
            return d;
          }),
        })),
      })),
      flaggedDuplicates: (s.flaggedDuplicates as FlaggedDuplicate[]).filter(
        (_: FlaggedDuplicate, i: number) => i !== dupIndex
      ),
    }));
    toast.success('Dishes grouped as variants');
  },

  dismissFlaggedDuplicate: (dupIndex: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set((s: any) => ({
      flaggedDuplicates: (s.flaggedDuplicates as FlaggedDuplicate[]).filter(
        (_: FlaggedDuplicate, i: number) => i !== dupIndex
      ),
    }));
  },

  acceptHighConfidence: (threshold: number) => {
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set((s: any) => {
      const updatedMenus = (s.editableMenus as EditableMenu[]).map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d.is_parent && d.confidence >= threshold && d.group_status === 'ai_proposed') {
              count++;
              return { ...d, group_status: 'accepted' as const };
            }
            if (d.parent_id) {
              // Check parent's ORIGINAL status (c.dishes is from the pre-update state)
              const parent = c.dishes.find(p => p._id === d.parent_id);
              if (
                parent &&
                parent.confidence >= threshold &&
                parent.group_status === 'ai_proposed'
              ) {
                return { ...d, group_status: 'accepted' as const };
              }
            }
            return d;
          }),
        })),
      }));
      return { editableMenus: updatedMenus };
    });
    if (count > 0) toast.success(`Accepted ${count} high-confidence group(s)`);
    else toast.info('No unreviewed high-confidence groups found');
  },

  acceptSelected: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = ((get() as any).selectedGroupIds as Set<string>).size;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set((s: any) => {
      const ids = s.selectedGroupIds as Set<string>;
      return {
        editableMenus: applyGroupStatus(
          s.editableMenus,
          d => ids.has(d._id) || (d.parent_id !== null && ids.has(d.parent_id)),
          'accepted'
        ),
        selectedGroupIds: new Set<string>(),
      };
    });
    toast.success(`Accepted ${count} group(s)`);
  },

  rejectSelected: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = ((get() as any).selectedGroupIds as Set<string>).size;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set((s: any) => {
      const ids = s.selectedGroupIds as Set<string>;
      return {
        editableMenus: applyGroupStatus(
          s.editableMenus,
          d => ids.has(d._id) || (d.parent_id !== null && ids.has(d.parent_id)),
          'rejected'
        ),
        selectedGroupIds: new Set<string>(),
      };
    });
    toast('Rejected selected groups', { icon: '✕' });
  },
});
