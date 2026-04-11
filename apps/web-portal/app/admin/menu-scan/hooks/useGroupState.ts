'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { EditableDish, EditableMenu, FlaggedDuplicate } from '@/lib/menu-scan';
import type { BatchFilters } from '@/components/admin/menu-scan/BatchToolbar';
import type { Step } from './menuScanTypes';

interface GroupDeps {
  editableMenus: EditableMenu[];
  setEditableMenus: React.Dispatch<React.SetStateAction<EditableMenu[]>>;
  step: Step;
  toggleExpand: (dishId: string) => void;
}

/** Manages group/batch state: duplicate flagging, batch acceptance, group review */
export function useGroupState(deps: GroupDeps) {
  // ---------- flagged duplicates from merge ----------
  const [flaggedDuplicates, setFlaggedDuplicates] = useState<FlaggedDuplicate[]>([]);

  // ---------- batch toolbar / group review state ----------
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [batchFilters, setBatchFilters] = useState<BatchFilters>({
    confidenceMin: null,
    dishKind: null,
    hasGrouping: null,
  });
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);

  // ---------- group management helpers ----------

  const acceptGroup = (parentId: string) => {
    deps.setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d._id === parentId || d.parent_id === parentId) {
              return { ...d, group_status: 'accepted' as const };
            }
            return d;
          }),
        })),
      }))
    );
    toast.success('Group accepted');
  };

  const rejectGroup = (parentId: string) => {
    deps.setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d._id === parentId || d.parent_id === parentId) {
              return { ...d, group_status: 'rejected' as const };
            }
            return d;
          }),
        })),
      }))
    );
    toast('Group rejected', { icon: '✕' });
  };

  const ungroupChild = (childId: string) => {
    deps.setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d._id === childId) {
              return { ...d, parent_id: null, is_parent: false, group_status: 'manual' as const };
            }
            if (d.variant_ids.includes(childId)) {
              const newVariantIds = d.variant_ids.filter(id => id !== childId);
              return {
                ...d,
                variant_ids: newVariantIds,
                is_parent: newVariantIds.length > 0,
              };
            }
            return d;
          }),
        })),
      }))
    );
    toast('Variant ungrouped');
  };

  const groupFlaggedDuplicate = (dupIndex: number) => {
    const dup = flaggedDuplicates[dupIndex];
    if (!dup) return;

    deps.setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d.name.toLowerCase().trim() === dup.existingDish.name.toLowerCase().trim()) {
              if (d.price === String(dup.existingDish.price)) {
                return {
                  ...d,
                  is_parent: true,
                  dish_kind: 'standard' as const,
                  display_price_prefix: 'from' as const,
                  group_status: 'manual' as const,
                };
              }
            }
            return d;
          }),
        })),
      }))
    );
    setFlaggedDuplicates(prev => prev.filter((_, i) => i !== dupIndex));
    toast.success('Dishes grouped as variants');
  };

  const dismissFlaggedDuplicate = (dupIndex: number) => {
    setFlaggedDuplicates(prev => prev.filter((_, i) => i !== dupIndex));
  };

  const getParentGroups = useCallback((): Array<{
    parent: EditableDish;
    children: EditableDish[];
    menuIdx: number;
    catIdx: number;
  }> => {
    const groups: Array<{
      parent: EditableDish;
      children: EditableDish[];
      menuIdx: number;
      catIdx: number;
    }> = [];

    deps.editableMenus.forEach((menu, mIdx) => {
      menu.categories.forEach((cat, cIdx) => {
        cat.dishes.forEach(dish => {
          if (dish.is_parent) {
            const children = cat.dishes.filter(d => d.parent_id === dish._id);
            groups.push({ parent: dish, children, menuIdx: mIdx, catIdx: cIdx });
          }
        });
      });
    });

    return groups;
  }, [deps.editableMenus]);

  const acceptHighConfidence = (threshold: number) => {
    let count = 0;
    deps.setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (d.is_parent && d.confidence >= threshold && d.group_status === 'ai_proposed') {
              count++;
              return { ...d, group_status: 'accepted' as const };
            }
            if (d.parent_id) {
              const parent = c.dishes.find(p => p._id === d.parent_id);
              if (parent && parent.confidence >= threshold && parent.group_status === 'ai_proposed') {
                return { ...d, group_status: 'accepted' as const };
              }
            }
            return d;
          }),
        })),
      }))
    );
    if (count > 0) toast.success(`Accepted ${count} high-confidence group(s)`);
    else toast.info('No unreviewed high-confidence groups found');
  };

  const acceptSelected = () => {
    deps.setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (selectedGroupIds.has(d._id) || (d.parent_id && selectedGroupIds.has(d.parent_id))) {
              return { ...d, group_status: 'accepted' as const };
            }
            return d;
          }),
        })),
      }))
    );
    toast.success(`Accepted ${selectedGroupIds.size} group(s)`);
    setSelectedGroupIds(new Set());
  };

  const rejectSelected = () => {
    deps.setEditableMenus(prev =>
      prev.map(m => ({
        ...m,
        categories: m.categories.map(c => ({
          ...c,
          dishes: c.dishes.map(d => {
            if (selectedGroupIds.has(d._id) || (d.parent_id && selectedGroupIds.has(d.parent_id))) {
              return { ...d, group_status: 'rejected' as const };
            }
            return d;
          }),
        })),
      }))
    );
    toast('Rejected selected groups', { icon: '✕' });
    setSelectedGroupIds(new Set());
  };

  // ---------- derived counts ----------
  const reviewedGroupCount = deps.editableMenus.reduce(
    (total, menu) =>
      total +
      menu.categories.reduce(
        (sum, cat) =>
          sum +
          cat.dishes.filter(
            d => d.is_parent && (d.group_status === 'accepted' || d.group_status === 'rejected')
          ).length,
        0
      ),
    0
  );

  const totalGroupCount = deps.editableMenus.reduce(
    (total, menu) =>
      total +
      menu.categories.reduce(
        (sum, cat) => sum + cat.dishes.filter(d => d.is_parent).length,
        0
      ),
    0
  );

  // ---------- keyboard shortcuts for group review (A/R/E) ----------
  useEffect(() => {
    if (deps.step !== 'review' || !focusedGroupId) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        acceptGroup(focusedGroupId);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        rejectGroup(focusedGroupId);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        deps.toggleExpand(focusedGroupId);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deps.step, focusedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    flaggedDuplicates,
    setFlaggedDuplicates,
    selectedGroupIds,
    setSelectedGroupIds,
    batchFilters,
    setBatchFilters,
    focusedGroupId,
    setFocusedGroupId,
    acceptGroup,
    rejectGroup,
    ungroupChild,
    groupFlaggedDuplicate,
    dismissFlaggedDuplicate,
    getParentGroups,
    acceptHighConfidence,
    acceptSelected,
    rejectSelected,
    reviewedGroupCount,
    totalGroupCount,
  };
}
