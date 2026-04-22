'use client';

import { useEffect, useRef } from 'react';
import { useReviewStore } from '../store';
import { CONFIDENCE_THRESHOLD } from '@/lib/menuScanConfig';
import type { EditableMenu, EditableDish } from '@/lib/menu-scan';

export interface UseKeyboardShortcutsOptions {
  onOpenSaveModal: () => void;
}

function getFlaggedDishes(menus: EditableMenu[]): EditableDish[] {
  return menus
    .flatMap(m => m.categories.flatMap(c => c.dishes))
    .filter(d => d.confidence < CONFIDENCE_THRESHOLD && d.group_status === 'ai_proposed');
}

/**
 * Mounts global keyboard shortcuts for the review page.
 *
 * Key bindings:
 *   E              — expand / collapse all dishes
 *   N              — scroll to next flagged (low-confidence) dish
 *   A              — accept focused group (when focusedGroupId is set)
 *   R              — reject focused group (when focusedGroupId is set)
 *   Escape         — close lightbox, then deselect focused group
 *   Cmd/Ctrl + S   — open save modal (fires even when focus is in an input)
 *
 * All shortcuts except Cmd/Ctrl+S are suppressed when focus is inside an
 * INPUT, TEXTAREA, SELECT, or contenteditable element.
 */
export function useKeyboardShortcuts({ onOpenSaveModal }: UseKeyboardShortcutsOptions): void {
  const editableMenus = useReviewStore(s => s.editableMenus);
  const expandedDishes = useReviewStore(s => s.expandedDishes);
  const focusedGroupId = useReviewStore(s => s.focusedGroupId);
  const lightboxOpen = useReviewStore(s => s.lightboxOpen);
  const acceptGroup = useReviewStore(s => s.acceptGroup);
  const rejectGroup = useReviewStore(s => s.rejectGroup);
  const setExpandedDishes = useReviewStore(s => s.setExpandedDishes);
  const setFocusedGroupId = useReviewStore(s => s.setFocusedGroupId);
  const setLightboxOpen = useReviewStore(s => s.setLightboxOpen);

  // Keep a stable ref to latest values so the handler (registered once) stays fresh.
  const storeRef = useRef({
    editableMenus,
    expandedDishes,
    focusedGroupId,
    lightboxOpen,
    onOpenSaveModal,
    acceptGroup,
    rejectGroup,
    setExpandedDishes,
    setFocusedGroupId,
    setLightboxOpen,
  });
  storeRef.current = {
    editableMenus,
    expandedDishes,
    focusedGroupId,
    lightboxOpen,
    onOpenSaveModal,
    acceptGroup,
    rejectGroup,
    setExpandedDishes,
    setFocusedGroupId,
    setLightboxOpen,
  };

  // Track current position in flagged-dish navigation cycle.
  const flaggedIdxRef = useRef<number>(-1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const inInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;

      // Cmd/Ctrl+S always fires — even inside inputs.
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        storeRef.current.onOpenSaveModal();
        return;
      }

      if (inInput) return;

      const {
        editableMenus,
        expandedDishes,
        focusedGroupId,
        lightboxOpen,
        acceptGroup,
        rejectGroup,
        setExpandedDishes,
        setFocusedGroupId,
        setLightboxOpen,
      } = storeRef.current;

      switch (e.key.toUpperCase()) {
        case 'E': {
          e.preventDefault();
          const allIds = editableMenus
            .flatMap(m => m.categories.flatMap(c => c.dishes))
            .map(d => d._id);
          setExpandedDishes(expandedDishes.size > 0 ? new Set<string>() : new Set(allIds));
          break;
        }
        case 'N': {
          e.preventDefault();
          const flagged = getFlaggedDishes(editableMenus);
          if (flagged.length === 0) return;
          flaggedIdxRef.current = (flaggedIdxRef.current + 1) % flagged.length;
          const dish = flagged[flaggedIdxRef.current];
          setExpandedDishes(prev => {
            const next = new Set(prev);
            next.add(dish._id);
            return next;
          });
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-dish-id="${dish._id}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
          break;
        }
        case 'A': {
          if (!focusedGroupId) return;
          e.preventDefault();
          acceptGroup(focusedGroupId);
          break;
        }
        case 'R': {
          if (!focusedGroupId) return;
          e.preventDefault();
          rejectGroup(focusedGroupId);
          break;
        }
        case 'ESCAPE': {
          if (lightboxOpen) {
            setLightboxOpen(false);
          } else if (focusedGroupId) {
            setFocusedGroupId(null);
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []); // empty deps — all live values read from storeRef.current
}
