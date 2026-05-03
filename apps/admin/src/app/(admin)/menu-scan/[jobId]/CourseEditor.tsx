'use client';

import type { EditableCourse, EditableCourseItem, EditableDish } from './useReviewState';

interface Props {
  parent: EditableDish;
  saving: boolean;
  onAddCourse: () => void;
  onRemoveCourse: (idx: number) => void;
  onMoveCourse: (from: number, to: number) => void;
  onUpdateCourse: (idx: number, patch: Partial<EditableCourse>) => void;
  onAddItem: (courseIdx: number) => void;
  onRemoveItem: (courseIdx: number, itemIdx: number) => void;
  onMoveItem: (courseIdx: number, from: number, to: number) => void;
  onUpdateItem: (courseIdx: number, itemIdx: number, patch: Partial<EditableCourseItem>) => void;
}

export function CourseEditor({
  parent,
  saving,
  onAddCourse,
  onRemoveCourse,
  onMoveCourse,
  onUpdateCourse,
  onAddItem,
  onRemoveItem,
  onMoveItem,
  onUpdateItem,
}: Props) {
  return (
    <div className="rounded border border-dashed border-purple-200 bg-purple-50/40 p-2 space-y-2 dark:border-purple-900/40 dark:bg-purple-950/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-purple-900 dark:text-purple-200">
          Courses ({parent.courses.length})
        </span>
        <button
          type="button"
          onClick={onAddCourse}
          disabled={saving}
          className="rounded border border-purple-300 bg-background px-2 py-0.5 text-xs hover:bg-purple-100 dark:border-purple-800 dark:hover:bg-purple-900/40 disabled:opacity-50"
        >
          + Add course
        </button>
      </div>

      {parent.courses.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground">
          No courses yet. Add at least one course for this tasting menu.
        </p>
      ) : (
        <ul className="space-y-2">
          {parent.courses.map((course, courseIdx) => (
            <CourseRow
              key={course._id}
              course={course}
              courseIdx={courseIdx}
              isFirst={courseIdx === 0}
              isLast={courseIdx === parent.courses.length - 1}
              saving={saving}
              onRemoveCourse={onRemoveCourse}
              onMoveCourse={onMoveCourse}
              onUpdateCourse={onUpdateCourse}
              onAddItem={onAddItem}
              onRemoveItem={onRemoveItem}
              onMoveItem={onMoveItem}
              onUpdateItem={onUpdateItem}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface CourseRowProps {
  course: EditableCourse;
  courseIdx: number;
  isFirst: boolean;
  isLast: boolean;
  saving: boolean;
  onRemoveCourse: (idx: number) => void;
  onMoveCourse: (from: number, to: number) => void;
  onUpdateCourse: (idx: number, patch: Partial<EditableCourse>) => void;
  onAddItem: (courseIdx: number) => void;
  onRemoveItem: (courseIdx: number, itemIdx: number) => void;
  onMoveItem: (courseIdx: number, from: number, to: number) => void;
  onUpdateItem: (courseIdx: number, itemIdx: number, patch: Partial<EditableCourseItem>) => void;
}

function CourseRow({
  course,
  courseIdx,
  isFirst,
  isLast,
  saving,
  onRemoveCourse,
  onMoveCourse,
  onUpdateCourse,
  onAddItem,
  onRemoveItem,
  onMoveItem,
  onUpdateItem,
}: CourseRowProps) {
  return (
    <li className="rounded border border-purple-200 bg-background p-2 space-y-2 dark:border-purple-900/40">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
          {course.course_number}.
        </span>
        <input
          aria-label="Course name"
          value={course.course_name}
          onChange={e => onUpdateCourse(courseIdx, { course_name: e.target.value })}
          disabled={saving}
          placeholder="Course name (e.g. Starter)"
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
        />
        <select
          aria-label="Choice type"
          value={course.choice_type}
          onChange={e =>
            onUpdateCourse(courseIdx, {
              choice_type: e.target.value as 'fixed' | 'one_of',
            })
          }
          disabled={saving}
          className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
        >
          <option value="fixed">Fixed</option>
          <option value="one_of">Choice</option>
        </select>
        {course.choice_type === 'one_of' && (
          <input
            aria-label="Required count"
            type="number"
            min="1"
            value={course.required_count}
            onChange={e =>
              onUpdateCourse(courseIdx, {
                required_count: Math.max(1, Number(e.target.value) || 1),
              })
            }
            disabled={saving}
            title="How many items the diner picks"
            className="w-12 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
          />
        )}
        <button
          type="button"
          onClick={() => onMoveCourse(courseIdx, courseIdx - 1)}
          disabled={saving || isFirst}
          aria-label="Move course up"
          className="rounded border border-border px-1.5 py-1 text-xs hover:bg-muted disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMoveCourse(courseIdx, courseIdx + 1)}
          disabled={saving || isLast}
          aria-label="Move course down"
          className="rounded border border-border px-1.5 py-1 text-xs hover:bg-muted disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onRemoveCourse(courseIdx)}
          disabled={saving}
          aria-label="Remove course"
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          ×
        </button>
      </div>

      <div className="pl-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            Items ({course.items.length})
          </span>
          <button
            type="button"
            onClick={() => onAddItem(courseIdx)}
            disabled={saving}
            className="rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
          >
            + Add item
          </button>
        </div>

        {course.items.length === 0 ? (
          <p className="text-[10px] italic text-muted-foreground">
            {course.choice_type === 'fixed'
              ? 'Add the single dish that makes up this course.'
              : 'Add the dishes diners can choose from.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {course.items.map((item, itemIdx) => (
              <li key={item._id} className="flex items-center gap-1.5">
                <input
                  aria-label="Item name"
                  value={item.option_label}
                  onChange={e => onUpdateItem(courseIdx, itemIdx, { option_label: e.target.value })}
                  disabled={saving}
                  placeholder="Item name"
                  className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
                />
                <span className="text-[10px] text-muted-foreground">+</span>
                <input
                  aria-label="Price delta"
                  type="number"
                  step="0.01"
                  value={item.price_delta}
                  onChange={e =>
                    onUpdateItem(courseIdx, itemIdx, {
                      price_delta: Number(e.target.value) || 0,
                    })
                  }
                  disabled={saving}
                  title="Surcharge above the menu base price (0 = no extra)"
                  className="w-20 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => onMoveItem(courseIdx, itemIdx, itemIdx - 1)}
                  disabled={saving || itemIdx === 0}
                  aria-label="Move item up"
                  className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveItem(courseIdx, itemIdx, itemIdx + 1)}
                  disabled={saving || itemIdx === course.items.length - 1}
                  aria-label="Move item down"
                  className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveItem(courseIdx, itemIdx)}
                  disabled={saving}
                  aria-label="Remove item"
                  className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
