import { CONFIDENCE_THRESHOLD } from '@/lib/menuScanConfig';
import { countDishes } from '@/lib/menu-scan';
import type { EditableMenu, EditableDish } from '@/lib/menu-scan';

/** Minimal slice of the store state that all selectors need. */
export interface MenusState {
  editableMenus: EditableMenu[];
}

function allDishes(state: MenusState): EditableDish[] {
  return state.editableMenus.flatMap(m => m.categories.flatMap(c => c.dishes));
}

/** Dishes that are low-confidence AND have not been touched (still ai_proposed). */
export function selectFlaggedDishes(state: MenusState): EditableDish[] {
  return allDishes(state).filter(
    d => d.confidence < CONFIDENCE_THRESHOLD && d.group_status === 'ai_proposed'
  );
}

/** All dishes grouped by their source image index (0-based). */
export function selectDishesByImageIndex(state: MenusState): Map<number, EditableDish[]> {
  const groups = new Map<number, EditableDish[]>();
  for (const dish of allDishes(state)) {
    const idx = dish.source_image_index ?? 0;
    const bucket = groups.get(idx);
    if (bucket) {
      bucket.push(dish);
    } else {
      groups.set(idx, [dish]);
    }
  }
  return groups;
}

export interface ConfirmSummary {
  insertCount: number;
  updateCount: number;
  acceptedFlaggedCount: number;
  untouchedFlaggedCount: number;
}

/** Summary counts for the SavePreviewModal. */
export function selectConfirmSummary(state: MenusState): ConfirmSummary {
  const dishes = allDishes(state);
  const flagged = dishes.filter(d => d.confidence < CONFIDENCE_THRESHOLD);
  return {
    insertCount: countDishes(state.editableMenus),
    updateCount: 0,
    acceptedFlaggedCount: flagged.filter(d => d.group_status !== 'ai_proposed').length,
    untouchedFlaggedCount: flagged.filter(d => d.group_status === 'ai_proposed').length,
  };
}

/** Total non-rejected dishes across all menus (consistent with confirm payload). */
export function selectTotalDishCount(state: MenusState): number {
  return countDishes(state.editableMenus);
}

/** All parent groups with their child variants. Used by group-review UI. */
export function selectParentGroups(state: MenusState): Array<{
  parent: EditableDish;
  children: EditableDish[];
}> {
  return state.editableMenus.flatMap(m =>
    m.categories.flatMap(c => {
      return c.dishes
        .filter(d => d.is_parent)
        .map(parent => ({
          parent,
          children: c.dishes.filter(d => d.parent_id === parent._id),
        }));
    })
  );
}
