'use client';

import { useFieldArray, type Control, type UseFormRegister } from 'react-hook-form';
import type { DishFormValues } from './DishForm';

interface CourseEditorSectionProps {
  control: Control<DishFormValues>;
  register: UseFormRegister<DishFormValues>;
}

export function CourseEditorSection({ control, register }: CourseEditorSectionProps) {
  const {
    fields: courses,
    append: appendCourse,
    remove: removeCourse,
  } = useFieldArray({
    control,
    name: 'courses',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Courses</h3>
        <button
          type="button"
          onClick={() =>
            appendCourse({
              course_number: courses.length + 1,
              course_name: '',
              required_count: 1,
              choice_type: 'one_of',
              items: [],
            })
          }
          className="text-xs text-primary hover:underline"
        >
          + Add course
        </button>
      </div>
      {courses.map((course, courseIdx) => (
        <CourseCard
          key={course.id}
          courseIdx={courseIdx}
          control={control}
          register={register}
          onRemove={() => removeCourse(courseIdx)}
        />
      ))}
      {courses.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No courses yet. Add a course to get started.
        </p>
      )}
    </div>
  );
}

function CourseCard({
  courseIdx,
  control,
  register,
  onRemove,
}: {
  courseIdx: number;
  control: Control<DishFormValues>;
  register: UseFormRegister<DishFormValues>;
  onRemove: () => void;
}) {
  const {
    fields: items,
    append: appendItem,
    remove: removeItem,
  } = useFieldArray({
    control,
    name: `courses.${courseIdx}.items`,
  });

  return (
    <div className="border border-border rounded-md p-3 space-y-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20">Course name</span>
        <input
          {...register(`courses.${courseIdx}.course_name`)}
          placeholder="e.g. Starter"
          className="flex-1 h-8 rounded border border-border px-2 text-sm"
        />
        <select
          {...register(`courses.${courseIdx}.choice_type`)}
          className="h-8 rounded border border-border px-2 text-sm"
        >
          <option value="one_of">One of</option>
          <option value="fixed">Fixed</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="text-destructive text-xs hover:underline"
        >
          Remove
        </button>
      </div>
      <div className="space-y-2 pl-2">
        {items.map((item, itemIdx) => (
          <div key={item.id} className="flex gap-2 items-center">
            <input
              {...register(`courses.${courseIdx}.items.${itemIdx}.option_label`)}
              placeholder="Option (e.g. Caesar Salad)"
              className="flex-1 h-7 rounded border border-border px-2 text-xs"
            />
            <input
              {...register(`courses.${courseIdx}.items.${itemIdx}.price_delta`, {
                valueAsNumber: true,
              })}
              type="number"
              placeholder="+price"
              step="0.01"
              className="w-20 h-7 rounded border border-border px-2 text-xs"
            />
            <button
              type="button"
              onClick={() => removeItem(itemIdx)}
              className="text-destructive text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendItem({ option_label: '', price_delta: 0, sort_order: items.length })}
          className="text-xs text-primary hover:underline"
        >
          + Add item
        </button>
      </div>
    </div>
  );
}
