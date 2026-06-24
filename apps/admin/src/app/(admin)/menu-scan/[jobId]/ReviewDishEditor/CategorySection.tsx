'use client';

import { type ReactNode } from 'react';

interface CategorySectionProps {
  meta: { displayName: string; descriptionLocked: boolean; badge: string | null };
  groupKey: string;
  dishCount: number;
  // Real sections this one can be merged into; label already carries the
  // source badge (e.g. "Appetizers · Canonical") so two groups that share a
  // display name stay distinguishable. Resolved in index.tsx (the label lookup
  // is impure — it closes over the category maps).
  mergeTargets: { key: string; label: string }[];
  hasActiveDishes: boolean;
  allSelected: boolean;
  saving: boolean;
  sourceLanguage: string;
  description: string;
  onMergeGroup: (targetKey: string) => void;
  onToggleGroupSelection: () => void;
  onUpdateGroupDescription: (value: string) => void;
  children: ReactNode;
}

export function CategorySection({
  meta,
  groupKey,
  dishCount,
  mergeTargets,
  hasActiveDishes,
  allSelected,
  saving,
  sourceLanguage,
  description,
  onMergeGroup,
  onToggleGroupSelection,
  onUpdateGroupDescription,
  children,
}: CategorySectionProps) {
  return (
    <section className="rounded-lg border border-border bg-muted/10">
      <header className="border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{meta.displayName}</h3>
            {meta.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium uppercase tracking-wide">
                {meta.badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {dishCount} dish
              {dishCount === 1 ? '' : 'es'}
            </span>
            {hasActiveDishes && mergeTargets.length > 0 && (
              <select
                aria-label={`Merge ${meta.displayName} into another section`}
                title="Move every dish in this section into another section"
                value=""
                onChange={e => onMergeGroup(e.target.value)}
                disabled={saving}
                className="rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
              >
                <option value="" disabled>
                  Merge into…
                </option>
                {mergeTargets.map(t => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={onToggleGroupSelection}
              disabled={saving || !hasActiveDishes}
              className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
            >
              {allSelected && hasActiveDishes ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        </div>
        {groupKey !== 'none' &&
          (meta.descriptionLocked ? (
            description && (
              <p className="text-xs text-muted-foreground italic">
                {description}{' '}
                <span className="not-italic text-[10px]">
                  (existing description — edit on the restaurant page)
                </span>
              </p>
            )
          ) : (
            <textarea
              aria-label={`${meta.displayName} description`}
              value={description}
              onChange={e => onUpdateGroupDescription(e.target.value)}
              disabled={saving}
              placeholder={`Section description (in ${sourceLanguage}, optional)`}
              rows={2}
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs disabled:opacity-50 resize-y"
            />
          ))}
      </header>

      {children}
    </section>
  );
}
