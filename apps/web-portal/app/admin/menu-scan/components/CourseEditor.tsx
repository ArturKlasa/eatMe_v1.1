'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, Plus, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { EditableCourse, EditableCourseItem } from '@/lib/menu-scan';
import { useReviewStore } from '../store';

// ---------------------------------------------------------------------------
// SortableCourseItemRow — one item inside a one_of course
// ---------------------------------------------------------------------------

interface CourseItemRowProps {
  dishId: string;
  courseIdx: number;
  itemIdx: number;
  item: EditableCourseItem;
}

function SortableCourseItemRow({ dishId, courseIdx, itemIdx, item }: CourseItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item._id,
  });
  const updateCourseItem = useReviewStore(s => s.updateCourseItem);
  const removeCourseItem = useReviewStore(s => s.removeCourseItem);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5"
      data-testid="course-item-row"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground p-0.5 shrink-0"
        data-testid="item-drag-handle"
        aria-label="Drag to reorder item"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <input
        value={item.option_label}
        onChange={e =>
          updateCourseItem(dishId, courseIdx, itemIdx, { option_label: e.target.value })
        }
        placeholder="Option label"
        className="flex-1 text-xs border border-input rounded px-2 py-1 focus:outline-none focus:border-brand-primary/70"
        data-testid="item-label-input"
      />
      <input
        type="number"
        value={item.price_delta}
        onChange={e =>
          updateCourseItem(dishId, courseIdx, itemIdx, {
            price_delta: parseFloat(e.target.value) || 0,
          })
        }
        placeholder="+0.00"
        step="0.01"
        className="w-16 text-xs text-right border border-input rounded px-1 py-1 focus:outline-none focus:border-brand-primary/70"
        data-testid="item-price-delta-input"
      />
      <button
        type="button"
        onClick={() => removeCourseItem(dishId, courseIdx, itemIdx)}
        className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
        aria-label="Remove item"
        data-testid="remove-item-btn"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableCourseCard — one collapsible course card
// ---------------------------------------------------------------------------

interface SortableCourseCardProps {
  dishId: string;
  courseIdx: number;
  course: EditableCourse;
}

function SortableCourseCard({ dishId, courseIdx, course }: SortableCourseCardProps) {
  const [open, setOpen] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: course._id,
  });

  const updateCourseField = useReviewStore(s => s.updateCourseField);
  const updateCourseItem = useReviewStore(s => s.updateCourseItem);
  const removeCourse = useReviewStore(s => s.removeCourse);
  const addCourseItem = useReviewStore(s => s.addCourseItem);
  const reorderCourseItems = useReviewStore(s => s.reorderCourseItems);

  const itemSensors = useSensors(useSensor(PointerSensor));

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = course.items.findIndex(i => i._id === active.id);
    const toIdx = course.items.findIndex(i => i._id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) {
      reorderCourseItems(dishId, courseIdx, fromIdx, toIdx);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-border rounded-md bg-background"
      data-testid="course-card"
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground p-0.5 shrink-0"
            aria-label="Drag to reorder course"
            data-testid="course-drag-handle"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-muted-foreground shrink-0">
            Course {course.course_number}
          </span>
          <input
            value={course.course_name}
            onChange={e => updateCourseField(dishId, courseIdx, { course_name: e.target.value })}
            placeholder="Course name (e.g. Starter)"
            className="flex-1 min-w-0 text-xs border border-input rounded px-2 py-0.5 focus:outline-none focus:border-brand-primary/70"
            data-testid="course-name-input"
          />
          <select
            value={course.choice_type}
            onChange={e =>
              updateCourseField(dishId, courseIdx, {
                choice_type: e.target.value as 'fixed' | 'one_of',
              })
            }
            className="text-xs border border-input rounded px-1 py-0.5 shrink-0"
            data-testid="choice-type-select"
          >
            <option value="fixed">Fixed</option>
            <option value="one_of">One of</option>
          </select>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label={open ? 'Collapse course' : 'Expand course'}
              data-testid="course-collapse-toggle"
            >
              {open ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </CollapsibleTrigger>
          <button
            type="button"
            onClick={() => removeCourse(dishId, courseIdx)}
            className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Remove course"
            data-testid="remove-course-btn"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <CollapsibleContent>
          <div className="px-3 pb-2.5 pt-1.5 space-y-2 border-t border-border">
            {course.choice_type === 'fixed' ? (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Fixed option
                </p>
                <input
                  value={course.items[0]?.option_label ?? ''}
                  onChange={e =>
                    course.items[0]
                      ? updateCourseItem(dishId, courseIdx, 0, { option_label: e.target.value })
                      : undefined
                  }
                  placeholder="Option label"
                  className="w-full text-xs border border-input rounded px-2 py-1 focus:outline-none focus:border-brand-primary/70"
                  data-testid="fixed-option-input"
                />
              </div>
            ) : (
              <>
                <DndContext
                  sensors={itemSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleItemDragEnd}
                >
                  <SortableContext
                    items={course.items.map(i => i._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5" data-testid="items-list">
                      {course.items.map((item, itemIdx) => (
                        <SortableCourseItemRow
                          key={item._id}
                          dishId={dishId}
                          courseIdx={courseIdx}
                          itemIdx={itemIdx}
                          item={item}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addCourseItem(dishId, courseIdx)}
                    className="flex items-center gap-1 text-xs text-info hover:text-info/80 transition-colors"
                    data-testid="add-item-btn"
                  >
                    <Plus className="h-3 w-3" />
                    Add item
                  </button>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                    Choose
                    <input
                      type="number"
                      min="1"
                      max={course.items.length || 1}
                      value={course.required_count}
                      onChange={e =>
                        updateCourseField(dishId, courseIdx, {
                          required_count: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-10 text-xs text-center border border-input rounded px-1 py-0.5"
                      data-testid="required-count-input"
                    />
                    of {course.items.length}
                  </label>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CourseEditor — main export
// ---------------------------------------------------------------------------

export interface CourseEditorProps {
  dishId: string;
}

export function CourseEditor({ dishId }: CourseEditorProps) {
  const editableMenus = useReviewStore(s => s.editableMenus);
  const addCourse = useReviewStore(s => s.addCourse);
  const reorderCourses = useReviewStore(s => s.reorderCourses);

  const courseSensors = useSensors(useSensor(PointerSensor));

  let courses: EditableCourse[] = [];
  outer: for (const menu of editableMenus) {
    for (const cat of menu.categories) {
      const dish = cat.dishes.find(d => d._id === dishId);
      if (dish) {
        courses = dish.courses ?? [];
        break outer;
      }
    }
  }

  function handleCourseDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = courses.findIndex(c => c._id === active.id);
    const toIdx = courses.findIndex(c => c._id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) {
      reorderCourses(dishId, fromIdx, toIdx);
    }
  }

  return (
    <div
      className="mt-2 border border-dashed border-brand-primary/30 rounded-lg p-2 space-y-2"
      data-testid="course-editor"
    >
      <p className="text-xs text-brand-primary font-medium">Courses ({courses.length})</p>

      <DndContext
        sensors={courseSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleCourseDragEnd}
      >
        <SortableContext items={courses.map(c => c._id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {courses.map((course, courseIdx) => (
              <SortableCourseCard
                key={course._id}
                dishId={dishId}
                courseIdx={courseIdx}
                course={course}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {courses.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          No courses yet. Click &quot;Add course&quot; to create the first course.
        </p>
      )}

      <button
        type="button"
        onClick={() => addCourse(dishId)}
        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-brand-primary/30 text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 transition-colors"
        data-testid="add-course-btn"
      >
        <Plus className="h-3 w-3" />
        Add course
      </button>
    </div>
  );
}
