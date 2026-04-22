'use client';

import { useEffect } from 'react';
import { useReviewStore } from '../store';
import type { EditableDish, EditableMenu } from '@/lib/menu-scan';
import type { BatchFilters } from '@/components/admin/menu-scan/BatchToolbar';
import type { Step } from './menuScanTypes';

interface GroupDeps {
  editableMenus: EditableMenu[];
  setEditableMenus: React.Dispatch<React.SetStateAction<EditableMenu[]>>;
  step: Step;
  toggleExpand: (dishId: string) => void;
}

/** Thin store wrapper — all group state and actions live in the Zustand store */
export function useGroupState(_deps: GroupDeps) {
  const flaggedDuplicates = useReviewStore(s => s.flaggedDuplicates);
  const selectedGroupIds = useReviewStore(s => s.selectedGroupIds);
  const batchFilters = useReviewStore(s => s.batchFilters);
  const focusedGroupId = useReviewStore(s => s.focusedGroupId);
  const step = useReviewStore(s => s.step);
  const editableMenus = useReviewStore(s => s.editableMenus);

  const setFlaggedDuplicates = useReviewStore(s => s.setFlaggedDuplicates);
  const setSelectedGroupIds = useReviewStore(s => s.setSelectedGroupIds);
  const setBatchFilters = useReviewStore(s => s.setBatchFilters);
  const setFocusedGroupId = useReviewStore(s => s.setFocusedGroupId);
  const acceptGroup = useReviewStore(s => s.acceptGroup);
  const rejectGroup = useReviewStore(s => s.rejectGroup);
  const ungroupChild = useReviewStore(s => s.ungroupChild);
  const groupFlaggedDuplicate = useReviewStore(s => s.groupFlaggedDuplicate);
  const dismissFlaggedDuplicate = useReviewStore(s => s.dismissFlaggedDuplicate);
  const acceptHighConfidence = useReviewStore(s => s.acceptHighConfidence);
  const acceptSelected = useReviewStore(s => s.acceptSelected);
  const rejectSelected = useReviewStore(s => s.rejectSelected);
  const toggleExpand = useReviewStore(s => s.toggleExpand);

  // Derived counts (computed from store state)
  const reviewedGroupCount = editableMenus.reduce(
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

  const totalGroupCount = editableMenus.reduce(
    (total, menu) =>
      total +
      menu.categories.reduce((sum, cat) => sum + cat.dishes.filter(d => d.is_parent).length, 0),
    0
  );

  // Keyboard shortcuts for focused group (A/R/E)
  useEffect(() => {
    if (step !== 'review' || !focusedGroupId) return;

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
        toggleExpand(focusedGroupId);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, focusedGroupId, acceptGroup, rejectGroup, toggleExpand]);

  const getParentGroups = () => {
    const groups: Array<{
      parent: EditableDish;
      children: EditableDish[];
      menuIdx: number;
      catIdx: number;
    }> = [];

    editableMenus.forEach((menu, mIdx) => {
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
  };

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
